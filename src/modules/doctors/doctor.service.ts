// src/modules/doctors/doctor.service.ts
import prisma from '../../prisma/client';
import {RoleType} from "@prisma/client"
import { v4 as uuidv4 } from 'uuid';

export class DoctorService {
  // Get doctor by ID (public)
  static async getDoctorById(id: string) {
    return prisma.doctor.findUnique({
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
  }

  static async getOwnDoctorProfile(userId: string) {
    return prisma.doctor.findUnique({
      where: { userId },
      include: { user: true, availability: true },
    });
  }

  static async updateDoctorProfile(doctorId: string, data: any) {
    return prisma.doctor.update({
      where: { id: doctorId },
      data,
      include: { user: true },
    });
  }
}
