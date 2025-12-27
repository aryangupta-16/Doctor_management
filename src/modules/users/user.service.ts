// src/modules/users/user.service.ts
import prisma from '../../prisma/client';
import { hashPassword, comparePassword } from '../../utils/password';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'profile-pictures');
fs.ensureDirSync(UPLOAD_DIR);

export class UserService {
  static async getMe(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          profilePicture: true,
          emailVerified: true,
          phoneVerified: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          profile: true,
          role: true
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to fetch user', 500);
    }
  }

  static async getUserById(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          profilePicture: true,
          emailVerified: true,
          phoneVerified: true,
          isActive: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              addressLine1: true,
              addressLine2: true,
              city: true,
              state: true,
              pincode: true,
              country: true,
              preferredLanguage: true
            }
          },
          doctor: {
            select: {
              id: true,
              specialtyPrimary: true,
              specialtiesSecondary: true,
              yearsOfExperience: true,
              bio: true,
              consultationFee: true,
              averageRating: true,
              totalConsultations: true,
              isVerified: true
            }
          }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to fetch user', 500);
    }
  }

  static async updateProfile(userId: string, payload: Partial<{
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    // any profile fields from UserProfile
  }>) {
    try {
      const { firstName, lastName, phoneNumber, dateOfBirth, gender, ...profileFields } = payload;
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
      if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      if (gender !== undefined) updates.gender = gender;

      const res = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: updates,
        });

        await tx.userProfile.upsert({
          where: { userId },
          update: { ...profileFields },
          create: { userId, ...profileFields }
        });

        await tx.auditLog.create({
          data: { userId, action: 'UPDATE', entityType: 'User', entityId: userId, metadata: { source: 'updateProfile' } }
        });

        return user;
      });

      return res;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to update profile', 500);
    }
  }

  static async uploadProfilePicture(userId: string, file: Express.Multer.File) {
    try {
      if (!file) throw new AppError('No file provided', 400);

      const ext = path.extname(file.originalname);
      const filename = `${userId}-${Date.now()}${ext}`;
      const dest = path.join(UPLOAD_DIR, filename);

      await fs.move(file.path, dest, { overwrite: true });

      const publicPath = `/uploads/profile-pictures/${filename}`;
      await prisma.user.update({
        where: { id: userId },
        data: { profilePicture: publicPath }
      });

      await prisma.auditLog.create({
        data: { userId, action: 'UPDATE', entityType: 'User', entityId: userId, metadata: { updated: 'profilePicture' } }
      });

      return { profilePicture: publicPath };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to upload profile picture', 500);
    }
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('User not found', 404);

      const ok = await comparePassword(oldPassword, user.passwordHash);
      if (!ok) throw new AppError('Old password is incorrect', 401);

      const hash = await hashPassword(newPassword);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });

      await prisma.userSession.deleteMany({ where: { userId }});

      await prisma.auditLog.create({
        data: { userId, action: 'UPDATE', entityType: 'User', entityId: userId, metadata: { changed: 'password' } }
      });

      return { ok: true };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to change password', 500);
    }
  }

  static async deleteUser(requesterId: string, targetUserId: string) {
    try {
      const requester = await prisma.user.findUnique({ where: { id: requesterId }});
      if (!requester) throw new AppError('Requester not found', 404);

      const isAdmin = requester.role === "ADMIN";

      if (requesterId !== targetUserId && !isAdmin) throw new AppError('Forbidden', 403);

      await prisma.auditLog.create({ data: { userId: requesterId, action: 'DELETE', entityType: 'User', entityId: targetUserId, metadata: { by: requesterId } } });

      await prisma.user.delete({ where: { id: targetUserId } });

      return { ok: true };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to delete user', 500);
    }
  }
}
