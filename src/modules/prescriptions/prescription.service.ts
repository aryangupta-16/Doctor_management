import prisma from "../../prisma/client";
import { AppError } from "../../utils/AppError";

type CreatePrescriptionInput = {
  consultationId: string;
  medications: any; // JSON array
  instructions?: string | null;
  validUntil?: string | Date | null;
};

type UpdatePrescriptionInput = {
  medications?: any;
  instructions?: string | null;
  validUntil?: string | Date | null;
};

type ListOptions = {
  page?: number;
  limit?: number;
  search?: string;
};

async function getDoctorIdByUserId(userId: string): Promise<string | null> {
  const d = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  return d?.id ?? null;
}

async function generatePrescriptionNumber(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const countToday = await prisma.prescription.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      },
    },
  });
  const seq = String(countToday + 1).padStart(3, "0");
  return `RX${y}${m}${d}${seq}`;
}

export default class PrescriptionService {
  static async createPrescription(doctorUserId: string, input: CreatePrescriptionInput) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const { consultationId, medications, instructions, validUntil } = input;

      const consultation = await prisma.consultation.findUnique({
        where: { id: consultationId },
        select: { id: true, doctorId: true, patientId: true },
      });
      if (!consultation) throw new AppError("Consultation not found", 404);
      if (consultation.doctorId !== doctorId) throw new AppError("Forbidden: Not your consultation", 403);

      const prescriptionNumber = await generatePrescriptionNumber();

      const prescription = await prisma.prescription.create({
        data: {
          prescriptionNumber,
          consultationId,
          doctorId,
          medications,
          instructions: instructions ?? null,
          validUntil: validUntil ? new Date(validUntil) : null,
        },
      });

      return prescription;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to create prescription", 500);
    }
  }

  static async getMyPrescriptions(userId: string, role: string, opts: ListOptions) {
    try {
      const page = Math.max(1, opts.page ?? 1);
      const take = Math.max(1, Math.min(50, opts.limit ?? 10));
      const skip = (page - 1) * take;

      let where: any = {};
      if (role === "PATIENT") {
        where.consultation = { patientId: userId };
      } else if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId) throw new AppError("Doctor profile not found", 404);
        where.doctorId = doctorId;
      } else {
        throw new AppError("Unauthorized role", 403);
      }

      const search = opts.search?.trim();
      if (search && search.length > 0) {
        where.OR = [
          { prescriptionNumber: { contains: search, mode: "insensitive" } },
          { consultation: { patient: { OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } }
          ] } } },
        ];
      }

      const [total, items] = await Promise.all([
        prisma.prescription.count({ where }),
        prisma.prescription.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            doctor: { select: { id: true, userId: true, specialtyPrimary: true } },
            consultation: {
              select: {
                id: true,
                consultationNumber: true,
                patient: { select: { id: true, firstName: true, lastName: true } },
                scheduledStartTime: true,
              },
            },
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to list prescriptions", 500);
    }
  }

  static async getPrescriptionById(id: string, userId: string, role: string) {
    try {
      const p = await prisma.prescription.findUnique({
        where: { id },
        include: {
          doctor: true,
          consultation: { include: { patient: true } },
        },
      });
      if (!p) throw new AppError("Prescription not found", 404);

      if (role === "PATIENT" && p.consultation.patientId !== userId) throw new AppError("Forbidden", 403);
      if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId || p.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      }

      return p;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get prescription", 500);
    }
  }

  static async getPrescriptionByConsultation(consultationId: string, userId: string, role: string) {
    try {
      const c = await prisma.consultation.findUnique({ where: { id: consultationId } });
      if (!c) throw new AppError("Consultation not found", 404);

      if (role === "PATIENT" && c.patientId !== userId) throw new AppError("Forbidden", 403);
      if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId || c.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      }

      const list = await prisma.prescription.findMany({
        where: { consultationId },
        orderBy: { createdAt: "desc" },
      });
      return list;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get prescriptions for consultation", 500);
    }
  }

  static async updatePrescription(id: string, doctorUserId: string, input: UpdatePrescriptionInput) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const p = await prisma.prescription.findUnique({ where: { id } });
      if (!p) throw new AppError("Prescription not found", 404);
      if (p.doctorId !== doctorId) throw new AppError("Forbidden", 403);

      const updated = await prisma.prescription.update({
        where: { id },
        data: {
          medications: input.medications ?? undefined,
          instructions: input.instructions ?? undefined,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        },
      });
      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to update prescription", 500);
    }
  }

  static async deletePrescription(id: string, doctorUserId: string) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const p = await prisma.prescription.findUnique({ where: { id } });
      if (!p) throw new AppError("Prescription not found", 404);
      if (p.doctorId !== doctorId) throw new AppError("Forbidden", 403);

      await prisma.prescription.delete({ where: { id } });
      return { id, deleted: true };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to delete prescription", 500);
    }
  }

  static async downloadPrescription(id: string, userId: string, role: string) {
    try {
      const p = await prisma.prescription.findUnique({
        where: { id },
        include: {
          doctor: { include: { user: true } },
          consultation: { include: { patient: true } },
        },
      });
      if (!p) throw new AppError("Prescription not found", 404);

      if (role === "PATIENT" && p.consultation.patientId !== userId) throw new AppError("Forbidden", 403);
      if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId || p.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      }

      const lines: string[] = [];
      lines.push("Prescription");
      lines.push(`Prescription Number: ${p.prescriptionNumber}`);
      lines.push(`Doctor: ${p.doctor.user.firstName} ${p.doctor.user.lastName}`);
      lines.push(`Patient: ${p.consultation.patient.firstName} ${p.consultation.patient.lastName}`);
      lines.push(`Valid Until: ${p.validUntil ? p.validUntil.toISOString() : "N/A"}`);
      lines.push("");
      lines.push("Medications:");
      const meds = Array.isArray(p.medications) ? p.medications : [];
      meds.forEach((m: any, i: number) => {
        const name = m?.name ?? "Unknown";
        const dosage = m?.dosage ?? m?.dose ?? "";
        const freq = m?.frequency ?? "";
        lines.push(`${i + 1}. ${name} ${dosage} ${freq}`.trim());
      });
      if (p.instructions) {
        lines.push("");
        lines.push("Instructions:");
        lines.push(p.instructions);
      }

      const content = lines.join("\n");
      const base64 = Buffer.from(content, "utf-8").toString("base64");

      return {
        fileName: `${p.prescriptionNumber}.txt`,
        contentType: "text/plain",
        base64,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to download prescription", 500);
    }
  }
}

