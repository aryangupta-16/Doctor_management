import prisma from "../../prisma/client";
import { SlotStatus } from "@prisma/client";

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
      // Match primary specialty (secondary specialties are stored as JSON and are not filtered here)
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

    // Note: languagesSpoken is JSON in schema; robust filtering on JSON arrays is omitted for portability.

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

    // Sorting
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
  },

  async getSpecialities() {
    const rows = await prisma.doctor.findMany({
      where: { isActive: true, isVerified: true },
      distinct: ["specialtyPrimary"],
      select: { specialtyPrimary: true },
      orderBy: { specialtyPrimary: "asc" },
    });
    return rows.map((r) => r.specialtyPrimary);
  },

  async getLocations() {
    // Cities and states for users who are doctors
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
  },

  async getFeaturedDoctors(limit?: number) {
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
  },
};

