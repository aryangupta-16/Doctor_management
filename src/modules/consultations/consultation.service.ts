import prisma from "../../prisma/client";
import { ConsultationStatus, ConsultationType, SlotStatus } from "@prisma/client";
import { AppError } from "../../utils/AppError";

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
    try {
      const { slotId, consultationType, chiefComplaint, symptoms } = data;

      const slot = await prisma.availabilitySlot.findUnique({
        where: { id: slotId },
        include: { doctor: true },
      });
      if (!slot) throw new AppError("Slot not found", 404);
      if (slot.status !== SlotStatus.AVAILABLE) throw new AppError("Slot not available", 400);
      if (slot.slotStartTime.getTime() <= Date.now()) throw new AppError("Cannot book a past slot", 400);

      const patient = await prisma.user.findUnique({ where: { id: patientUserId } });
      if (!patient) throw new AppError("Patient not found", 404);

      const consultationNumber = await generateConsultationNumber();

      const result = await prisma.$transaction(async (tx) => {
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

        await tx.availabilitySlot.update({
          where: { id: slot.id },
          data: { status: SlotStatus.BOOKED, consultationId: consultation.id, reservedByUserId: null, reservedAt: null, expiresAt: null },
        });

        return consultation;
      });

      return result;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to book consultation", 500);
    }
  }

  static async getMyConsultations(
    userId: string,
    role: string,
    options: { status?: ConsultationStatus; page?: number; limit?: number }
  ) {
    try {
      const page = Math.max(1, options.page ?? 1);
      const take = Math.max(1, Math.min(50, options.limit ?? 10));
      const skip = (page - 1) * take;

      let where: any = {};
      if (role === "PATIENT") {
        where.patientId = userId;
      } else if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId) throw new AppError("Doctor profile not found", 404);
        where.doctorId = doctorId;
      } else {
        throw new AppError("Unauthorized role", 403);
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
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch consultations", 500);
    }
  }

  static async getConsultationById(id: string, userId: string, role: string) {
    try {
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
      if (!c) throw new AppError("Consultation not found", 404);

      if (role === "PATIENT" && c.patientId !== userId) throw new AppError("Forbidden", 403);
      if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId || c.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      }

      return c;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get consultation", 500);
    }
  }

  static async cancelConsultation(
    id: string,
    userId: string,
    role: string,
    _input: CancelInput
  ) {
    try {
      const consultation = await prisma.consultation.findUnique({ where: { id } });
      if (!consultation) throw new AppError("Consultation not found", 404);

      if (role === "PATIENT" && consultation.patientId !== userId) throw new AppError("Forbidden", 403);
      if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId || consultation.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      }

      if (
        consultation.status === ConsultationStatus.COMPLETED ||
        consultation.status === ConsultationStatus.CANCELLED
      ) {
        throw new AppError("Consultation cannot be cancelled", 400);
      }

      const updated = await prisma.$transaction(async (tx) => {
        const cons = await tx.consultation.update({
          where: { id },
          data: { status: ConsultationStatus.CANCELLED },
        });

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
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to cancel consultation", 500);
    }
  }

  static async rescheduleConsultation(
    id: string,
    userId: string,
    role: string,
    input: RescheduleInput
  ) {
    try {
      const { newSlotId } = input;
      const consultation = await prisma.consultation.findUnique({ where: { id } });
      if (!consultation) throw new AppError("Consultation not found", 404);

      if (role === "PATIENT" && consultation.patientId !== userId) throw new AppError("Forbidden", 403);
      if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId || consultation.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      }

      if (consultation.status === ConsultationStatus.COMPLETED)
        throw new AppError("Completed consultations cannot be rescheduled", 400);

      const newSlot = await prisma.availabilitySlot.findUnique({ where: { id: newSlotId } });
      if (!newSlot) throw new AppError("New slot not found", 404);
      if (newSlot.status !== SlotStatus.AVAILABLE) throw new AppError("New slot is not available", 400);
      if (newSlot.doctorId !== consultation.doctorId) throw new AppError("Slot must belong to the same doctor", 400);

      const updated = await prisma.$transaction(async (tx) => {
        if (consultation.slotId) {
          await tx.availabilitySlot.update({
            where: { id: consultation.slotId },
            data: { status: SlotStatus.AVAILABLE, consultationId: null },
          });
        }

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
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to reschedule consultation", 500);
    }
  }

  static async startConsultation(id: string, doctorUserId: string) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const consultation = await prisma.consultation.findUnique({ where: { id } });
      if (!consultation) throw new AppError("Consultation not found", 404);
      if (consultation.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      if (consultation.status !== ConsultationStatus.SCHEDULED)
        throw new AppError("Only scheduled consultations can be started", 400);

      const now = new Date();
      const updated = await prisma.consultation.update({
        where: { id },
        data: { status: ConsultationStatus.IN_PROGRESS, actualStartTime: now },
      });
      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to start consultation", 500);
    }
  }

  static async completeConsultation(id: string, doctorUserId: string, input: CompleteInput) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const consultation = await prisma.consultation.findUnique({ where: { id } });
      if (!consultation) throw new AppError("Consultation not found", 404);
      if (consultation.doctorId !== doctorId) throw new AppError("Forbidden", 403);
      if (
        !(
          consultation.status === ConsultationStatus.SCHEDULED ||
          consultation.status === ConsultationStatus.IN_PROGRESS
        )
      )
        throw new AppError("Consultation cannot be completed", 400);

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

        if (cons.slotId) {
          await tx.availabilitySlot.update({
            where: { id: cons.slotId },
            data: { status: SlotStatus.COMPLETED },
          });
        }
        return cons;
      });

      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to complete consultation", 500);
    }
  }

  static async updateConsultationNotes(
    id: string,
    doctorUserId: string,
    input: { doctorNotes?: string | null }
  ) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const consultation = await prisma.consultation.findUnique({ where: { id } });
      if (!consultation) throw new AppError("Consultation not found", 404);
      if (consultation.doctorId !== doctorId) throw new AppError("Forbidden", 403);

      const updated = await prisma.consultation.update({
        where: { id },
        data: { doctorNotes: input.doctorNotes ?? null },
      });
      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to update consultation notes", 500);
    }
  }

  // ====== NEW METHODS FOR ADMIN, PATIENTS, AND DOCTORS ======

  // ADMIN: Get all consultations with filters
  static async getAllConsultations(options: {
    status?: ConsultationStatus;
    page?: number;
    limit?: number;
    patientId?: string;
    doctorId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    try {
      const page = Math.max(1, options.page ?? 1);
      const take = Math.max(1, Math.min(100, options.limit ?? 10));
      const skip = (page - 1) * take;

      const where: any = {};
      if (options.status) where.status = options.status;
      if (options.patientId) where.patientId = options.patientId;
      if (options.doctorId) where.doctorId = options.doctorId;
      if (options.startDate || options.endDate) {
        where.scheduledStartTime = {};
        if (options.startDate) where.scheduledStartTime.gte = options.startDate;
        if (options.endDate) where.scheduledStartTime.lte = options.endDate;
      }

      const [total, items] = await Promise.all([
        prisma.consultation.count({ where }),
        prisma.consultation.findMany({
          where,
          orderBy: { scheduledStartTime: "desc" },
          skip,
          take,
          include: {
            doctor: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } }, specialtyPrimary: true } },
            patient: { select: { id: true, firstName: true, lastName: true, email: true } },
            payment: { select: { id: true, status: true, amount: true } },
            prescriptions: { select: { id: true } },
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch consultations", 500);
    }
  }

  // PATIENT: Get patient's consultations with filters
  static async getPatientConsultations(
    patientId: string,
    options: {
      status?: ConsultationStatus;
      page?: number;
      limit?: number;
      doctorId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const page = Math.max(1, options.page ?? 1);
      const take = Math.max(1, Math.min(50, options.limit ?? 10));
      const skip = (page - 1) * take;

      const where: any = { patientId };
      if (options.status) where.status = options.status;
      if (options.doctorId) where.doctorId = options.doctorId;
      if (options.startDate || options.endDate) {
        where.scheduledStartTime = {};
        if (options.startDate) where.scheduledStartTime.gte = options.startDate;
        if (options.endDate) where.scheduledStartTime.lte = options.endDate;
      }

      const [total, items] = await Promise.all([
        prisma.consultation.count({ where }),
        prisma.consultation.findMany({
          where,
          orderBy: { scheduledStartTime: "desc" },
          skip,
          take,
          include: {
            doctor: {
              select: {
                id: true,
                user: { select: { firstName: true, lastName: true, profilePicture: true } },
                specialtyPrimary: true,
                averageRating: true,
              },
            },
            payment: { select: { id: true, status: true, amount: true } },
            prescriptions: { select: { id: true, prescriptionNumber: true } },
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch patient consultations", 500);
    }
  }

  // DOCTOR: Get doctor's consultations with filters
  static async getDoctorConsultations(
    doctorUserId: string,
    options: {
      status?: ConsultationStatus;
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const page = Math.max(1, options.page ?? 1);
      const take = Math.max(1, Math.min(50, options.limit ?? 10));
      const skip = (page - 1) * take;

      const where: any = { doctorId };
      if (options.status) where.status = options.status;
      if (options.startDate || options.endDate) {
        where.scheduledStartTime = {};
        if (options.startDate) where.scheduledStartTime.gte = options.startDate;
        if (options.endDate) where.scheduledStartTime.lte = options.endDate;
      }

      const [total, items] = await Promise.all([
        prisma.consultation.count({ where }),
        prisma.consultation.findMany({
          where,
          orderBy: { scheduledStartTime: "desc" },
          skip,
          take,
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                profilePicture: true,
              },
            },
            payment: { select: { id: true, status: true, amount: true } },
            prescriptions: true,
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch doctor consultations", 500);
    }
  }

  // Get pending consultations (SCHEDULED status)
  static async getPendingConsultations(
    doctorUserId: string,
    options: { page?: number; limit?: number }
  ) {
    try {
      const doctorId = await getDoctorIdByUserId(doctorUserId);
      if (!doctorId) throw new AppError("Doctor profile not found", 404);

      const page = Math.max(1, options.page ?? 1);
      const take = Math.max(1, Math.min(50, options.limit ?? 10));
      const skip = (page - 1) * take;

      const where = {
        doctorId,
        status: ConsultationStatus.SCHEDULED,
      };

      const [total, items] = await Promise.all([
        prisma.consultation.count({ where }),
        prisma.consultation.findMany({
          where,
          orderBy: { scheduledStartTime: "asc" },
          skip,
          take,
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
              },
            },
            slot: { select: { slotStartTime: true, slotEndTime: true } },
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch pending consultations", 500);
    }
  }

  // Get upcoming consultations (for both patient and doctor)
  static async getUpcomingConsultations(
    userId: string,
    role: string,
    options: { page?: number; limit?: number }
  ) {
    try {
      const page = Math.max(1, options.page ?? 1);
      const take = Math.max(1, Math.min(50, options.limit ?? 10));
      const skip = (page - 1) * take;

      const now = new Date();
      let where: any = {
        scheduledStartTime: { gte: now },
        status: { in: [ConsultationStatus.SCHEDULED, ConsultationStatus.IN_PROGRESS] },
      };

      if (role === "PATIENT") {
        where.patientId = userId;
      } else if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId) throw new AppError("Doctor profile not found", 404);
        where.doctorId = doctorId;
      } else {
        throw new AppError("Invalid role", 400);
      }

      const [total, items] = await Promise.all([
        prisma.consultation.count({ where }),
        prisma.consultation.findMany({
          where,
          orderBy: { scheduledStartTime: "asc" },
          skip,
          take,
          include: {
            doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } }, specialtyPrimary: true } },
            patient: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch upcoming consultations", 500);
    }
  }

  // Get completed consultations
  static async getCompletedConsultations(
    userId: string,
    role: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const page = Math.max(1, options.page ?? 1);
      const take = Math.max(1, Math.min(50, options.limit ?? 10));
      const skip = (page - 1) * take;

      let where: any = { status: ConsultationStatus.COMPLETED };

      if (role === "PATIENT") {
        where.patientId = userId;
      } else if (role === "DOCTOR") {
        const doctorId = await getDoctorIdByUserId(userId);
        if (!doctorId) throw new AppError("Doctor profile not found", 404);
        where.doctorId = doctorId;
      } else {
        throw new AppError("Invalid role", 400);
      }

      if (options.startDate || options.endDate) {
        where.actualEndTime = {};
        if (options.startDate) where.actualEndTime.gte = options.startDate;
        if (options.endDate) where.actualEndTime.lte = options.endDate;
      }

      const [total, items] = await Promise.all([
        prisma.consultation.count({ where }),
        prisma.consultation.findMany({
          where,
          orderBy: { actualEndTime: "desc" },
          skip,
          take,
          include: {
            doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } }, specialtyPrimary: true } },
            patient: { select: { id: true, firstName: true, lastName: true } },
            prescriptions: { select: { id: true } },
            review: true,
          },
        }),
      ]);

      return { page, limit: take, total, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch completed consultations", 500);
    }
  }
}

