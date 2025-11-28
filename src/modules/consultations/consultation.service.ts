import prisma from "../../prisma/client";
import { ConsultationStatus, ConsultationType, SlotStatus } from "@prisma/client";

type Paginated = { page?: number; limit?: number };

type BookConsultationInput = {
  slotId: string;
  consultationType?: ConsultationType;
  chiefComplaint?: string;
  symptoms?: any; // JSON array per schema
};

type CancelInput = {
  reason: string;
  cancelledBy: string; // Role or user identifier; stored in audit log if desired
};

type RescheduleInput = {
  newSlotId: string;
  reason: string;
};

type CompleteInput = {
  diagnosis?: string | null;
  doctorNotes?: string | null;
  followUpRequired?: boolean | null;
  folllowUpDate?: string | Date | null; // controller typo handled here
};

async function getDoctorIdByUserId(userId: string): Promise<string | null> {
  const d = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  return d?.id ?? null;
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

async function generateConsultationNumber(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const countToday = await prisma.consultation.count({
    where: { createdAt: { gte: dayStart, lte: dayEnd } },
  });
  const seq = String(countToday + 1).padStart(3, "0");
  return `CONS${y}${m}${d}${seq}`;
}

export default class ConsultationService {
  // Book a consultation directly against an AVAILABLE slot
  static async bookConsultation(patientUserId: string, data: BookConsultationInput) {
    const { slotId, consultationType, chiefComplaint, symptoms } = data;

    console.log(slotId);
    const slot = await prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      include: { doctor: true },
    });
    if (!slot) throw new Error("Slot not found");
    if (slot.status !== SlotStatus.AVAILABLE) throw new Error("Slot not available");
    if (slot.slotStartTime.getTime() <= Date.now()) throw new Error("Cannot book a past slot");

    // Ensure patient user exists
    const patient = await prisma.user.findUnique({ where: { id: patientUserId } });
    if (!patient) throw new Error("Patient not found");

    const consultationNumber = await generateConsultationNumber();

    const result = await prisma.$transaction(async (tx) => {
      // Create consultation
      const consultation = await tx.consultation.create({
        data: {
          consultationNumber,
          patientId: patientUserId,
          doctorId: slot.doctorId,
          slotId: slot.id,
          scheduledStartTime: slot.slotStartTime,
          scheduledEndTime: slot.slotEndTime,
          consultationType: consultationType ?? ConsultationType.VIDEO,
          status: ConsultationStatus.SCHEDULED,
          consultationFee: slot.doctor.consultationFee,
          chiefComplaint: chiefComplaint ?? null,
          symptoms: symptoms ?? null,
        },
      });

      // Mark slot as BOOKED and link consultation
      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: { status: SlotStatus.BOOKED, consultationId: consultation.id, reservedByUserId: null, reservedAt: null, expiresAt: null },
      });

      return consultation;
    });

    return result;
  }

  static async getMyConsultations(
    userId: string,
    role: string,
    options: { status?: ConsultationStatus; page?: number; limit?: number }
  ) {
    const page = Math.max(1, options.page ?? 1);
    const take = Math.max(1, Math.min(50, options.limit ?? 10));
    const skip = (page - 1) * take;

    console.log(role);
    let where: any = {};
    if (role === "PATIENT") {
      where.patientId = userId;
    } else if (role === "DOCTOR") {
      const doctorId = await getDoctorIdByUserId(userId);
      if (!doctorId) throw new Error("Doctor profile not found");
      where.doctorId = doctorId;
    } else {
      throw new Error("Unauthorized role");
    }

    if (options.status) where.status = options.status;

    const [total, items] = await Promise.all([
      prisma.consultation.count({ where }),
      prisma.consultation.findMany({
        where,
        orderBy: { scheduledStartTime: "desc" },
        skip,
        take,
        include: {
          doctor: { select: { id: true, userId: true, specialtyPrimary: true, consultationFee: true } },
          patient: { select: { id: true, firstName: true, lastName: true } },
          slot: true,
          prescriptions: true,
        },
      }),
    ]);

    return { page, limit: take, total, items };
  }

  static async getConsultationById(id: string, userId: string, role: string) {
    const c = await prisma.consultation.findUnique({
      where: { id },
      include: {
        doctor: true,
        patient: true,
        slot: true,
        prescriptions: true,
        payment: true,
      },
    });
    if (!c) throw new Error("Consultation not found");

    if (role === "PATIENT" && c.patientId !== userId) throw new Error("Forbidden");
    if (role === "DOCTOR") {
      const doctorId = await getDoctorIdByUserId(userId);
      if (!doctorId || c.doctorId !== doctorId) throw new Error("Forbidden");
    }

    return c;
  }

  static async cancelConsultation(
    id: string,
    userId: string,
    role: string,
    _input: CancelInput
  ) {
    const consultation = await prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new Error("Consultation not found");

    // Auth: patient or doctor who owns
    if (role === "PATIENT" && consultation.patientId !== userId) throw new Error("Forbidden");
    if (role === "DOCTOR") {
      const doctorId = await getDoctorIdByUserId(userId);
      if (!doctorId || consultation.doctorId !== doctorId) throw new Error("Forbidden");
    }

    if (
      consultation.status === ConsultationStatus.COMPLETED ||
      consultation.status === ConsultationStatus.CANCELLED
    ) {
      throw new Error("Consultation cannot be cancelled");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Set consultation to CANCELLED
      const cons = await tx.consultation.update({
        where: { id },
        data: { status: ConsultationStatus.CANCELLED },
      });

      // Free the associated slot if exists and is BOOKED/RESERVED
      if (cons.slotId) {
        const slot = await tx.availabilitySlot.findUnique({ where: { id: cons.slotId } });
        if (slot) {
          await tx.availabilitySlot.update({
            where: { id: slot.id },
            data: { status: SlotStatus.AVAILABLE, consultationId: null, reservedByUserId: null, reservedAt: null, expiresAt: null },
          });
        }
      }
      return cons;
    });

    return updated;
  }

  static async rescheduleConsultation(
    id: string,
    userId: string,
    role: string,
    input: RescheduleInput
  ) {
    const { newSlotId } = input;
    const consultation = await prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new Error("Consultation not found");

    // Auth
    if (role === "PATIENT" && consultation.patientId !== userId) throw new Error("Forbidden");
    if (role === "DOCTOR") {
      const doctorId = await getDoctorIdByUserId(userId);
      if (!doctorId || consultation.doctorId !== doctorId) throw new Error("Forbidden");
    }

    if (consultation.status === ConsultationStatus.COMPLETED)
      throw new Error("Completed consultations cannot be rescheduled");

    const newSlot = await prisma.availabilitySlot.findUnique({ where: { id: newSlotId } });
    if (!newSlot) throw new Error("New slot not found");
    if (newSlot.status !== SlotStatus.AVAILABLE) throw new Error("New slot is not available");
    if (newSlot.doctorId !== consultation.doctorId) throw new Error("Slot must belong to the same doctor");

    const updated = await prisma.$transaction(async (tx) => {
      // Free previous slot
      if (consultation.slotId) {
        await tx.availabilitySlot.update({
          where: { id: consultation.slotId },
          data: { status: SlotStatus.AVAILABLE, consultationId: null },
        });
      }

      // Link new slot and mark it booked
      const cons = await tx.consultation.update({
        where: { id },
        data: {
          slotId: newSlot.id,
          scheduledStartTime: newSlot.slotStartTime,
          scheduledEndTime: newSlot.slotEndTime,
          status: ConsultationStatus.SCHEDULED,
        },
      });

      await tx.availabilitySlot.update({
        where: { id: newSlot.id },
        data: { status: SlotStatus.BOOKED, consultationId: cons.id },
      });

      return cons;
    });

    return updated;
  }

  static async startConsultation(id: string, doctorUserId: string) {
    const doctorId = await getDoctorIdByUserId(doctorUserId);
    if (!doctorId) throw new Error("Doctor profile not found");

    const consultation = await prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new Error("Consultation not found");
    if (consultation.doctorId !== doctorId) throw new Error("Forbidden");
    if (consultation.status !== ConsultationStatus.SCHEDULED)
      throw new Error("Only scheduled consultations can be started");

    const now = new Date();
    const updated = await prisma.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.IN_PROGRESS, actualStartTime: now },
    });
    return updated;
  }

  static async completeConsultation(id: string, doctorUserId: string, input: CompleteInput) {
    const doctorId = await getDoctorIdByUserId(doctorUserId);
    if (!doctorId) throw new Error("Doctor profile not found");

    const consultation = await prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new Error("Consultation not found");
    if (consultation.doctorId !== doctorId) throw new Error("Forbidden");
    if (
      !(
        consultation.status === ConsultationStatus.SCHEDULED ||
        consultation.status === ConsultationStatus.IN_PROGRESS
      )
    )
      throw new Error("Consultation cannot be completed");

    const now = new Date();
    const followUpDate = input.folllowUpDate ? new Date(input.folllowUpDate) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const cons = await tx.consultation.update({
        where: { id },
        data: {
          status: ConsultationStatus.COMPLETED,
          actualEndTime: now,
          diagnosis: input.diagnosis ?? null,
          doctorNotes: input.doctorNotes ?? null,
          followUpRequired: input.followUpRequired ?? false,
          followUpDate,
        },
      });

      // Mark slot as COMPLETED as well
      if (cons.slotId) {
        await tx.availabilitySlot.update({
          where: { id: cons.slotId },
          data: { status: SlotStatus.COMPLETED },
        });
      }
      return cons;
    });

    return updated;
  }

  static async updateConsultationNotes(
    id: string,
    doctorUserId: string,
    input: { doctorNotes?: string | null }
  ) {
    const doctorId = await getDoctorIdByUserId(doctorUserId);
    if (!doctorId) throw new Error("Doctor profile not found");

    const consultation = await prisma.consultation.findUnique({ where: { id } });
    if (!consultation) throw new Error("Consultation not found");
    if (consultation.doctorId !== doctorId) throw new Error("Forbidden");

    const updated = await prisma.consultation.update({
      where: { id },
      data: { doctorNotes: input.doctorNotes ?? null },
    });
    return updated;
  }
}

