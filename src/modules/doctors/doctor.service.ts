// src/modules/doctors/doctor.service.ts
import prisma from '../../prisma/client';
import { RoleType } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../utils/AppError';

export class DoctorService {
  // Get doctor by ID (public)
  static async getDoctorById(id: string) {
    try {
      const doc = await prisma.doctor.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
            },
          },
          reviews: true,
        },
      });

      if (!doc) {
        throw new AppError('Doctor not found', 404);
      }

      return doc;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to fetch doctor', 500);
    }
  }

  static async getOwnDoctorProfile(userId: string) {
    try {
      const doc = await prisma.doctor.findUnique({
        where: { userId },
        include: { user: true, availability: true },
      });

      if (!doc) {
        throw new AppError('Doctor profile not found', 404);
      }

      return doc;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to fetch doctor profile', 500);
    }
  }

  static async updateDoctorProfile(doctorId: string, data: any) {
    try {
      const updatedDoc = await prisma.doctor.update({
        where: { id: doctorId },
        data,
        include: { user: true },
      });
      
      return updatedDoc;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      // Prisma not found error
      if (err && err.code === 'P2025') {
        throw new AppError('Doctor not found', 404);
      }
      throw new AppError('Failed to update doctor profile', 500);
    }
  }
}
