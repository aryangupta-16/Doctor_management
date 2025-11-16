// src/modules/users/user.service.ts
import prisma from '../../prisma/client';
import { hashPassword, comparePassword } from '../../utils/password';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../config/logger';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'profile-pictures');
fs.ensureDirSync(UPLOAD_DIR);

export class UserService {
  static async getMe(userId: string) {
    return prisma.user.findUnique({
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
    const { firstName, lastName, phoneNumber, dateOfBirth, gender, ...profileFields } = payload;
    const updates: any = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) updates.gender = gender;

    // transaction: update user and upsert profile
    const res = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: updates,
      });

      // upsert UserProfile
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
  }

  static async uploadProfilePicture(userId: string, file: Express.Multer.File) {
    if (!file) throw new Error('NO_FILE');

    const ext = path.extname(file.originalname);
    const filename = `${userId}-${Date.now()}${ext}`;
    const dest = path.join(UPLOAD_DIR, filename);

    await fs.move(file.path, dest, { overwrite: true });

    const publicPath = `/uploads/profile-pictures/${filename}`; // for static serving
    const user = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: publicPath }
    });

    await prisma.auditLog.create({
      data: { userId, action: 'UPDATE', entityType: 'User', entityId: userId, metadata: { updated: 'profilePicture' } }
    });

    return { profilePicture: publicPath };
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('USER_NOT_FOUND');

    const ok = await comparePassword(oldPassword, user.passwordHash);
    if (!ok) throw new Error('INVALID_OLD_PASSWORD');

    const hash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });

    // Revoke sessions (force re-login)
    await prisma.userSession.deleteMany({ where: { userId }});

    await prisma.auditLog.create({
      data: { userId, action: 'UPDATE', entityType: 'User', entityId: userId, metadata: { changed: 'password' } }
    });

    return { ok: true };
  }

  static async deleteUser(requesterId: string, targetUserId: string) {
    // Check if requester is admin or same user
    const requester = await prisma.user.findUnique({ where: { id: requesterId }});
    if (!requester) throw new Error('REQUESTER_NOT_FOUND');

    const isAdmin = requester.role === "ADMIN";

    if (requesterId !== targetUserId && !isAdmin) throw new Error('FORBIDDEN');

    // Permanent delete: cascade will remove profiles etc per schema
    await prisma.auditLog.create({ data: { userId: requesterId, action: 'DELETE', entityType: 'User', entityId: targetUserId, metadata: { by: requesterId } } });

    await prisma.user.delete({ where: { id: targetUserId } });

    return { ok: true };
  }
}
