import prisma from '../../prisma/client';
import { Prisma, RoleType } from '@prisma/client';
import { hashPassword, comparePassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, signEmailToken, signResetToken, verifyToken } from '../../utils/jwt';
import { config } from '../../config';
import redis from '../../lib/redis';
// import { sendEmail } from '../../lib/mailer';
import { emailProducer } from '../../common/queue/email.producer.service';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';

export class AuthService {
  // Register user: create user + profile, email verification email sent
  static async register(data: { email: string; password: string; firstName?: string; lastName?: string; phoneNumber?: string }) {
    try {
      const { email, password, firstName, lastName, phoneNumber } = data;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError('Email already exists', 400);
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: firstName || '',
          lastName: lastName || '',
          phoneNumber: phoneNumber || null,
          role: RoleType.PATIENT,
          profile: {
            create: {
            },
          },
        },
      });

      await prisma.auditLog.create({ data: { userId: user.id, action: 'CREATE', entityType: 'User', entityId: user.id } });

      const emailToken = signEmailToken({ sub: user.id, type: 'email_verification' });
      const verifyUrl = `${config.appBaseUrl}/api/auth/verify-email?token=${emailToken}`;
      const html = `<p>Hello ${user.firstName || user.email},</p>
        <p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>
        <p>If you did not sign up, ignore this email.</p>`;

      await emailProducer.queueVerificationEmail(user.email, emailToken, html, `Verify: ${verifyUrl}`);

      return { id: user.id, email: user.email };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to register user', 500);
    }
  }


  static async registerDoctor(data: { email: string; password: string; firstName?: string; lastName?: string; phoneNumber?: string, licenseNumber?: string,specialtyPrimary?: string, yearsOfExperience?: number, consultationFee?: number }) {
    try {
      const { email, password, firstName, lastName, phoneNumber, licenseNumber,specialtyPrimary, yearsOfExperience, consultationFee } = data;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError('Email already exists', 400);
      }

      const existingDoctor = await prisma.doctor.findUnique({where: {licenseNumber: licenseNumber}})

      if(existingDoctor){
          throw new AppError('Doctor with this registration number already exists', 400);
      }
      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: firstName || '',
          lastName: lastName || '',
          phoneNumber: phoneNumber || null,
          role: RoleType.DOCTOR,
          doctor: {
            create: {
              licenseNumber : licenseNumber || '',
              specialtyPrimary: specialtyPrimary || '', 
              yearsOfExperience: yearsOfExperience || 0, 
              consultationFee: consultationFee || 500
            },
          },
        },
        include: {
          doctor: true,
        }
      });

      await prisma.auditLog.create({ data: { userId: user.id, action: 'CREATE', entityType: 'User', entityId: user.id } });

      const emailToken = signEmailToken({ sub: user.id, type: 'email_verification' });
      const verifyUrl = `${config.appBaseUrl}/api/auth/verify-email?token=${emailToken}`;
      const html = `<p>Hello ${user.firstName || user.email},</p>
        <p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>
        <p>If you did not sign up, ignore this email.</p>`;

      await emailProducer.queueVerificationEmail(user.email, emailToken, html, `Verify: ${verifyUrl}`);

      return { id: user.id, email: user.email };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to register doctor', 500);
    }
  }

  // Login: validate password, update last login, create refresh token session
  static async login({ email, password, deviceInfo }: { email: string; password: string; deviceInfo?: any }) {
    try {
      const user = await prisma.user.findUnique({ where: { email }, include: {
          doctor : true
      }});
      if (!user) {
        throw new AppError('Invalid credentials', 401);
      }

      if(user.role === RoleType.DOCTOR && user.doctor){
          if(!user.doctor.isVerified){
              throw new AppError('Your account is pending for admin approval', 403);
          }
      }

      const ok = await comparePassword(password, user.passwordHash);

      if (!ok) {
        await prisma.auditLog.create({ data: { userId: user.id, action: 'ACCESS', entityType: 'User', entityId: user.id, metadata: { failedLogin: true } } });
        throw new AppError('Invalid credentials', 401);
      }

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await prisma.auditLog.create({ data: { userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id } });
      
      const accessToken = signAccessToken({ sub: user.id, roles: user.role});
      const refreshToken = signRefreshToken({ sub: user.id, roles: user.role});

      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: uuidv4(),
          refreshToken,
          deviceInfo: deviceInfo || {},
          expiresAt: new Date(Date.now() + AuthService.msFromDuration(config.jwtRefreshExpiry)),
        },
      });

      return { accessToken, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to login', 500);
    }
  }

  // Refresh: verify refresh JWT and ensure it matches DB-stored refresh token
  static async refresh({ refreshToken }: { refreshToken: string }) {
    try {
      let payload: any;
      try {
        payload = verifyToken(refreshToken);
      } catch (err) {
        throw new AppError('Invalid refresh token', 401);
      }
      const userId = payload.sub;

      const session = await prisma.userSession.findFirst({ where: { userId, refreshToken } });
      if (!session) {
        throw new AppError('Invalid refresh token', 401);
      }

      await prisma.userSession.delete({ where: { id: session.id } });

      const newRefreshToken = signRefreshToken({ sub: userId, role: payload.role });
      const newAccessToken = signAccessToken({ sub: userId, role: payload.role });

      await prisma.userSession.create({
        data: {
          userId,
          token: uuidv4(),
          refreshToken: newRefreshToken,
          deviceInfo: session.deviceInfo as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + AuthService.msFromDuration(config.jwtRefreshExpiry)),
        },
      });

      await prisma.auditLog.create({ data: { userId, action: 'ACCESS', entityType: 'User', entityId: userId, metadata: { rotatedRefresh: true } } });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to refresh token', 500);
    }
  }

  // Logout: revoke refresh token (delete session)
  static async logout({ refreshToken }: { refreshToken: string }) {
    await prisma.userSession.deleteMany({ where: { refreshToken } });
    // optionally write audit log for logout (if we can find user via token)
    try {
      const payload: any = verifyToken(refreshToken);
      await prisma.auditLog.create({ data: { userId: payload.sub, action: 'LOGOUT', entityType: 'User', entityId: payload.sub } });
    } catch (err) {
      /* ignore */
    }
    return { ok: true };
  }

  // Forgot password: send reset link (signed JWT)
  static async forgotPassword({ email }: { email: string }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // do not reveal the existence of email
      return { ok: true };
    }

    const resetToken = signResetToken({ sub: user.id, type: 'reset_password' });
    const resetUrl = `${config.appBaseUrl}/reset-password?token=${resetToken}`;
    const html = `<p>Hello ${user.firstName || user.email},</p>
      <p>To reset your password click <a href="${resetUrl}">here</a>. This link expires in ${config.jwtResetPwdExpiry || '1 hour'}.</p>
      <p>If you did not request this, ignore this email.</p>`;

    await emailProducer.queueResetPasswordEmail(
  user.email,
  resetToken,
  html,
  `Reset Password: ${resetUrl}`
);
    await prisma.auditLog.create({ data: { userId: user.id, action: 'ACCESS', entityType: 'User', entityId: user.id, metadata: { forgotPassword: true } } });

    return { ok: true };
  }

  // Reset password using token (signed JWT)
  static async resetPassword({ token, newPassword }: { token: string; newPassword: string }) {
    let payload: any;
    try {
      payload = verifyToken(token);
    } catch (err) {
      throw new Error('INVALID_RESET_TOKEN');
    }
    const userId = payload.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('USER_NOT_FOUND');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await prisma.auditLog.create({ data: { userId, action: 'UPDATE', entityType: 'User', entityId: userId, metadata: { resetPassword: true } } });

    // revoke all sessions (force re-login)
    await prisma.userSession.deleteMany({ where: { userId } });
    return { ok: true };
  }

  // Verify email link
  static async verifyEmail({ token }: { token: string }) {
    let payload: any;
    try {
      payload = verifyToken(token);
    } catch (err) {
      throw new Error('INVALID_VERIFICATION_TOKEN');
    }
    const userId = payload.sub;
    await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
    await prisma.auditLog.create({ data: { userId, action: 'UPDATE', entityType: 'User', entityId: userId, metadata: { emailVerified: true } } });
    return { ok: true };
  }

  static async resendVerification({ email }: { email: string }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };
    if (user.emailVerified) return { ok: true };

    const token = signEmailToken({ sub: user.id, type: 'email_verification' });
    const verifyUrl = `${config.appBaseUrl}/api/auth/verify-email?token=${token}`;
    const html = `<p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>`;
    await emailProducer.queueVerificationEmail(user.email, token, html, `Verify: ${verifyUrl}`);
    return { ok: true };
  }

  // Utility: parse durations like "7d","15m"
  static msFromDuration(duration: string) {
    if (!duration) return 0;
    const v = duration;
    const val = parseInt(v.slice(0, -1), 10);
    if (v.endsWith('m')) return val * 60 * 1000;
    if (v.endsWith('h')) return val * 60 * 60 * 1000;
    if (v.endsWith('d')) return val * 24 * 60 * 60 * 1000;
    return 0;
  }
}
