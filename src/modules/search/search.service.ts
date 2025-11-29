import prisma from "../../prisma/client";
import { SlotStatus } from "@prisma/client";
import { AppError } from "../../utils/AppError";

type SearchFilters = {
  speciality?: string;
  city?: string;
  state?: string;
  minRating?: number;
  maxFee?: number;
  minFee?: number;
  experience?: number;
  language?: string;
  gender?: string;
  hasAvailability?: boolean;
  date?: Date;
  page: number;
  limit: number;
  sortBy?: string; // rating | fee | experience | consultations | createdAt
  sortOrder?: "asc" | "desc";
};

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

export const searchService = {
  async searchDoctors(filters: SearchFilters) {
    try {
      const {
        speciality,
        city,
        state,
        minRating,
        minFee,
        maxFee,
        experience,
        language,
        gender,
        hasAvailability,
        date,
        page,
        limit,
        sortBy,
        sortOrder,
      } = filters;

      const where: any = {
        isActive: true,
        isVerified: true,
      };

      if (speciality) {
        where.specialtyPrimary = { equals: speciality, mode: "insensitive" };
      }

      if (typeof minRating === "number") {
        where.averageRating = { gte: minRating };
      }

      if (typeof experience === "number") {
        where.yearsOfExperience = { gte: experience };
      }

      if (typeof minFee === "number" || typeof maxFee === "number") {
        where.consultationFee = {
          ...(typeof minFee === "number" ? { gte: minFee } : {}),
          ...(typeof maxFee === "number" ? { lte: maxFee } : {}),
        };
      }

      if (gender || city || state) {
        where.user = {
          is: {
            ...(gender ? { gender } : {}),
            ...(city || state
              ? {
                  profile: {
                    is: {
                      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
                      ...(state ? { state: { equals: state, mode: "insensitive" } } : {}),
                    },
                  },
                }
              : {}),
          },
        };
      }

      if (hasAvailability) {
        const timeFilter = date
          ? { gte: startOfDay(date), lte: endOfDay(date) }
          : undefined;
        where.slots = {
          some: {
            status: SlotStatus.AVAILABLE,
            ...(timeFilter ? { slotStartTime: timeFilter } : {}),
          },
        };
      }

      let orderBy: any = undefined;
      if (sortBy) {
        const map: Record<string, string> = {
          rating: "averageRating",
          fee: "consultationFee",
          experience: "yearsOfExperience",
          consultations: "totalConsultations",
          createdAt: "createdAt",
        };
        const field = map[sortBy] || "averageRating";
        orderBy = { [field]: sortOrder || "desc" };
      } else {
        orderBy = { averageRating: "desc" };
      }

      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
      const take = Math.max(1, limit);

      const [total, items] = await Promise.all([
        prisma.doctor.count({ where }),
        prisma.doctor.findMany({
          where,
          orderBy,
          skip,
          take,
          select: {
            id: true,
            userId: true,
            specialtyPrimary: true,
            specialtiesSecondary: true,
            yearsOfExperience: true,
            bio: true,
            consultationFee: true,
            consultationDuration: true,
            languagesSpoken: true,
            averageRating: true,
            totalConsultations: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                gender: true,
                profile: {
                  select: {
                    city: true,
                    state: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      return {
        page: Math.max(1, page),
        limit: take,
        total,
        items,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to search doctors", 500);
    }
  },

  async getSpecialities() {
    try {
      const rows = await prisma.doctor.findMany({
        where: { isActive: true, isVerified: true },
        distinct: ["specialtyPrimary"],
        select: { specialtyPrimary: true },
        orderBy: { specialtyPrimary: "asc" },
      });
      return rows.map((r) => r.specialtyPrimary);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get specialities", 500);
    }
  },

  async getLocations() {
    try {
      const profiles = await prisma.userProfile.findMany({
        where: {
          user: { doctor: { isNot: null } },
        },
        select: { city: true, state: true },
      });

      const cities = Array.from(
        new Set(profiles.map((p) => p.city).filter((v): v is string => !!v))
      ).sort((a, b) => a.localeCompare(b));
      const states = Array.from(
        new Set(profiles.map((p) => p.state).filter((v): v is string => !!v))
      ).sort((a, b) => a.localeCompare(b));

      return { cities, states };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get locations", 500);
    }
  },

  async getFeaturedDoctors(limit?: number) {
    try {
      const take = limit && limit > 0 ? limit : 10;
      const items = await prisma.doctor.findMany({
        where: { isActive: true, isVerified: true },
        orderBy: [
          { averageRating: "desc" },
          { totalConsultations: "desc" },
        ],
        take,
        select: {
          id: true,
          userId: true,
          specialtyPrimary: true,
          yearsOfExperience: true,
          averageRating: true,
          totalConsultations: true,
          consultationFee: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              profile: { select: { city: true, state: true } },
            },
          },
        },
      });
      return items;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get featured doctors", 500);
    }
  },
};

