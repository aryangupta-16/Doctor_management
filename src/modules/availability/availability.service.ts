import prisma from "../../prisma/client";
import { SlotStatus } from "@prisma/client";
import { AppError } from "../../utils/AppError";

type CreateWeeklyScheduleInput = {
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
};

type UpdateWeeklyScheduleInput = Partial<CreateWeeklyScheduleInput> & {
  isActive?: boolean;
};

type GenerateSlotsInput = {
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  slotDuration: number; // minutes
};

type GetSlotsQuery = {
  date?: string;
  status?: any;
  startDate?: any;
  endDate?: any;
};

type BlockSlotsInput = {
  slotIds: string[];
  reason?: string; // Not persisted (no field in schema), accepted for API compatibility
};

type GetDoctorAvailableSlotsQuery = {
  date?: any;
  startDate?: any;
  endDate?: any;
  limit?: any;
};

function parseTimeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  )
    throw new Error("Invalid time format. Expected HH:MM");
  return hh * 60 + mm;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

function toDateOnly(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error("Invalid date provided");
  return d;
}

export default class AvailabilityService {
  // Doctor weekly schedule CRUD ======================================
  static async createWeeklySchedule(
    doctorId: string,
    input: CreateWeeklyScheduleInput
  ) {
    try {
      const { dayOfWeek, startTime, endTime } = input;

      if (dayOfWeek < 0 || dayOfWeek > 6)
        throw new AppError("dayOfWeek must be between 0 (Sun) and 6 (Sat)", 400);

      const startMins = parseTimeToMinutes(startTime);
      const endMins = parseTimeToMinutes(endTime);
      if (endMins <= startMins)
        throw new AppError("endTime must be greater than startTime", 400);

      const overlaps = await prisma.doctorAvailability.findFirst({
        where: {
          doctorId,
          dayOfWeek,
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
          isActive: true,
        },
      });
      if (overlaps) {
        throw new AppError("Overlapping schedule exists for the given day", 409);
      }

      return await prisma.doctorAvailability.create({
        data: {
          doctorId,
          dayOfWeek,
          startTime,
          endTime,
        },
      });
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to create weekly schedule", 500);
    }
  }

  static async getWeeklySchedule(doctorId: string) {
    try {
      return await prisma.doctorAvailability.findMany({
        where: { doctorId },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to fetch weekly schedule", 500);
    }
  }

  static async updateWeeklySchedule(
    doctorId: string,
    scheduleId: string,
    input: UpdateWeeklyScheduleInput
  ) {
    try {
      const existing = await prisma.doctorAvailability.findUnique({
        where: { id: scheduleId },
      });
      if (!existing || existing.doctorId !== doctorId) {
        throw new AppError("Schedule not found for this doctor", 404);
      }

      if (input.dayOfWeek !== undefined) {
        if (input.dayOfWeek < 0 || input.dayOfWeek > 6)
          throw new AppError("dayOfWeek must be between 0 and 6", 400);
      }
      if (input.startTime) parseTimeToMinutes(input.startTime);
      if (input.endTime) parseTimeToMinutes(input.endTime);
      if (input.startTime && input.endTime) {
        if (
          parseTimeToMinutes(input.endTime) <= parseTimeToMinutes(input.startTime)
        )
          throw new AppError("endTime must be greater than startTime", 400);
      }

      return await prisma.doctorAvailability.update({
        where: { id: scheduleId },
        data: {
          dayOfWeek: input.dayOfWeek ?? undefined,
          startTime: input.startTime ?? undefined,
          endTime: input.endTime ?? undefined,
          isActive: input.isActive ?? undefined,
        },
      });
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to update weekly schedule", 500);
    }
  }

  static async deleteWeeklySchedule(doctorId: string, scheduleId: string) {
    try {
      const existing = await prisma.doctorAvailability.findUnique({
        where: { id: scheduleId },
      });
      if (!existing || existing.doctorId !== doctorId) {
        throw new AppError("Schedule not found for this doctor", 404);
      }

      await prisma.doctorAvailability.delete({ where: { id: scheduleId } });
      return { id: scheduleId, deleted: true };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to delete weekly schedule", 500);
    }
  }

  // Slots ============================================================
  static async generateSlots(doctorId: string, input: GenerateSlotsInput) {
    try {
      const { startDate, endDate, slotDuration } = input;
      if (!startDate || !endDate) throw new AppError("startDate and endDate required", 400);
      if (!slotDuration || slotDuration <= 0)
        throw new AppError("slotDuration must be a positive number of minutes", 400);

      const start = startOfDay(toDateOnly(startDate));
      const end = endOfDay(toDateOnly(endDate));
      if (end < start) throw new AppError("endDate must be on/after startDate", 400);

    // Fetch weekly schedules once
      const schedules = await prisma.doctorAvailability.findMany({
        where: { doctorId, isActive: true },
      });

      if (schedules.length === 0) {
        return { created: 0, skipped: 0, slots: [] };
      }

    // Fetch existing slots in range to avoid duplicates
      const existingSlots = await prisma.availabilitySlot.findMany({
        where: {
          doctorId,
          slotStartTime: { gte: start },
          slotEndTime: { lte: end },
        },
        select: { slotStartTime: true },
      });
    const existingStartSet = new Set(
      existingSlots.map((s) => s.slotStartTime.toISOString())
    );

    const toCreate: { slotStartTime: Date; slotEndTime: Date }[] = [];

      for (
        let day = new Date(start.getTime());
        day.getTime() <= end.getTime();
        day = addMinutes(day, 24 * 60)
      ) {
      const dow = day.getDay();
      const daySchedules = schedules.filter((s) => s.dayOfWeek === dow);
      if (daySchedules.length === 0) continue;

        for (const sch of daySchedules) {
        const startMins = parseTimeToMinutes(sch.startTime);
        const endMins = parseTimeToMinutes(sch.endTime);

        // Build the concrete Date for this day's window
        const windowStart = new Date(day);
        windowStart.setHours(0, 0, 0, 0);
        const slotWindowStart = addMinutes(windowStart, startMins);
        const slotWindowEnd = addMinutes(windowStart, endMins);

        // Generate slots
          for (
            let slotStart = new Date(slotWindowStart);
            addMinutes(slotStart, slotDuration) <= slotWindowEnd;
            slotStart = addMinutes(slotStart, slotDuration)
          ) {
          const slotEnd = addMinutes(slotStart, slotDuration);
          const key = slotStart.toISOString();
          if (!existingStartSet.has(key)) {
            toCreate.push({ slotStartTime: slotStart, slotEndTime: slotEnd });
          }
        }
        }
      }

      if (toCreate.length === 0) {
        return { created: 0, skipped: 0, slots: [] };
      }

      const BATCH = 200;
      const createdSlots: any[] = [];
      for (let i = 0; i < toCreate.length; i += BATCH) {
        const batch = toCreate.slice(i, i + BATCH);
        const created = await prisma.$transaction(
          batch.map((b) =>
            prisma.availabilitySlot.create({
              data: {
                doctorId,
                slotStartTime: b.slotStartTime,
                slotEndTime: b.slotEndTime,
                status: SlotStatus.AVAILABLE,
              },
            })
          )
        );
        createdSlots.push(...created);
      }

      return { created: createdSlots.length, skipped: 0, slots: createdSlots };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to generate slots", 500);
    }
  }

  static async getSlots(doctorId: string, query: GetSlotsQuery) {
    try {
      const { date, status, startDate, endDate } = query;

      let timeFilter: { gte?: Date; lte?: Date } = {};
      if (date) {
        const theDay = toDateOnly(String(date));
        timeFilter = { gte: startOfDay(theDay), lte: endOfDay(theDay) };
      } else if (startDate || endDate) {
        const g = startDate ? startOfDay(toDateOnly(String(startDate))) : undefined;
        const l = endDate ? endOfDay(toDateOnly(String(endDate))) : undefined;
        timeFilter = { ...(g ? { gte: g } : {}), ...(l ? { lte: l } : {}) };
      }

      let statusFilter: any = undefined;
      if (status !== undefined) {
        const asArray = Array.isArray(status)
          ? status
          : String(status).split(",").map((s) => s.trim()).filter(Boolean);
        statusFilter = { in: asArray as SlotStatus[] };
      }

      const slots = await prisma.availabilitySlot.findMany({
        where: {
          doctorId,
          ...(Object.keys(timeFilter).length ? { slotStartTime: timeFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        orderBy: [{ slotStartTime: "asc" }],
      });

      return { count: slots.length, slots };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get slots", 500);
    }
  }

  static async blockSlots(doctorId: string, input: BlockSlotsInput) {
    try {
      const { slotIds } = input;
      if (!slotIds || slotIds.length === 0)
        throw new AppError("slotIds are required", 400);

      const updated: any[] = [];
      for (const id of slotIds) {
        const slot = await prisma.availabilitySlot.findUnique({ where: { id } });
        if (!slot || slot.doctorId !== doctorId) continue;
        const upd = await prisma.availabilitySlot.update({
          where: { id },
          data: { status: SlotStatus.CANCELLED },
        });
        updated.push(upd);
      }

      return { updatedCount: updated.length, slots: updated };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to block slots", 500);
    }
  }

  static async getDoctorAvailableSlots(
    doctorId: string,
    query: GetDoctorAvailableSlotsQuery
  ) {
    try {
      const { date, startDate, endDate, limit } = query;

      let timeFilter: { gte?: Date; lte?: Date } = {};
      if (date) {
        const theDay = toDateOnly(String(date));
        timeFilter = { gte: startOfDay(theDay), lte: endOfDay(theDay) };
      } else if (startDate || endDate) {
        const g = startDate ? startOfDay(toDateOnly(String(startDate))) : undefined;
        const l = endDate ? endOfDay(toDateOnly(String(endDate))) : undefined;
        timeFilter = { ...(g ? { gte: g } : {}), ...(l ? { lte: l } : {}) };
      }

      const take = limit ? Math.max(1, parseInt(String(limit), 10)) : undefined;

      const slots = await prisma.availabilitySlot.findMany({
        where: {
          doctorId,
          status: SlotStatus.AVAILABLE,
          ...(Object.keys(timeFilter).length ? { slotStartTime: timeFilter } : {}),
        },
        orderBy: [{ slotStartTime: "asc" }],
        ...(take ? { take } : {}),
      });

      return { count: slots.length, slots };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get doctor available slots", 500);
    }
  }
}

