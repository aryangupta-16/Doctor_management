import prisma from '../../prisma/client';
import { AuditAction, ConsultationStatus, PaymentStatus, RoleType } from '@prisma/client';
import { AppError } from '../../utils/AppError';

export class AdminService {
  // Dashboard statistics
  static async getDashboardStats() {
    try {
      const [users, doctors, consultations, revenueAgg] = await Promise.all([
        prisma.user.count(),
        prisma.doctor.count(),
        prisma.consultation.count(),
        prisma.payment.aggregate({
          where: { status: PaymentStatus.COMPLETED },
          _sum: { amount: true },
        }),
      ]);

      return {
        users,
        doctors,
        consultations,
        revenue: revenueAgg._sum.amount ?? 0,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get dashboard stats", 500);
    }
  }

  // Doctors approval flows
  static async getPendingDoctors() {
    try {
      return await prisma.doctor.findMany({
        where: { isVerified: false },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get pending doctors", 500);
    }
  }

  static async approveDoctor(doctorId: string, adminUserId: string) {
    try {
      const updated = await prisma.doctor.update({
        where: { id: doctorId },
        data: { isVerified: true, verifiedAt: new Date(), verifiedBy: adminUserId },
      });

      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: AuditAction.UPDATE,
          entityType: 'Doctor',
          entityId: doctorId,
          metadata: { action: 'approve_doctor' },
        },
      });

      return updated;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to approve doctor", 500);
    }
  }

  static async rejectDoctor(doctorId: string, adminUserId: string, reason: string) {
    try {
      const doctor = await prisma.doctor.update({
        where: { id: doctorId },
        data: { isVerified: false, verifiedAt: null, verifiedBy: null },
      });

      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: AuditAction.UPDATE,
          entityType: 'Doctor',
          entityId: doctorId,
          metadata: { action: 'reject_doctor', reason },
        },
      });

      return doctor;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to reject doctor", 500);
    }
  }

  // Users list with filters
  static async listUsers(params: {
    role?: RoleType;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const { role, isActive, search, page = 1, limit = 20 } = params;
      const where = {
        ...(role ? { role } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' as const } },
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      } as any;

      const [total, items] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return { total, page, limit, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to list users", 500);
    }
  }

  static async suspendUser(userId: string, adminUserId: string, reason?: string) {
    try {
      const user = await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: AuditAction.UPDATE,
          entityType: 'User',
          entityId: userId,
          metadata: { action: 'suspend_user', reason },
        },
      });
      return user;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to suspend user", 500);
    }
  }

  static async reactivateUser(userId: string, adminUserId: string) {
    try {
      const user = await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: AuditAction.UPDATE,
          entityType: 'User',
          entityId: userId,
          metadata: { action: 'reactivate_user' },
        },
      });
      return user;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to reactivate user", 500);
    }
  }

  // Analytics: consultations
  static async consultationAnalytics(params: {
    startDate?: string;
    endDate?: string;
    speciality?: string;
  }) {
    try {
      const { startDate, endDate, speciality } = params;
      const where: any = {};
      if (startDate || endDate) {
        where.scheduledStartTime = {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {}),
        };
      }
      if (speciality) {
        where.doctor = { specialtyPrimary: speciality };
      }

      const total = await prisma.consultation.count({ where });

      const byStatus = await prisma.consultation.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      });

      const statusBreakdown = Object.values(ConsultationStatus).reduce((acc, s) => {
        const found = byStatus.find((b) => b.status === s);
        acc[s] = found?._count._all ?? 0;
        return acc;
      }, {} as Record<string, number>);

      let bySpecialty: Array<{ specialty: string; count: number }> = [];
      if (!speciality) {
        const groups = await prisma.consultation.groupBy({
          by: ['doctorId'],
          where,
          _count: { _all: true },
        });
        const doctorIds = groups.map((g) => g.doctorId);
        const doctors = await prisma.doctor.findMany({
          where: { id: { in: doctorIds } },
          select: { id: true, specialtyPrimary: true },
        });
        const map: Record<string, number> = {};
        for (const g of groups) {
          const doc = doctors.find((d) => d.id === g.doctorId);
          const key = doc?.specialtyPrimary ?? 'Unknown';
          map[key] = (map[key] ?? 0) + g._count._all;
        }
        bySpecialty = Object.entries(map).map(([specialty, count]) => ({ specialty, count }));
      }

      return { total, statusBreakdown, bySpecialty };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get consultation analytics", 500);
    }
  }

  // Analytics: revenue
  static async revenueAnalytics(params: { startDate?: string; endDate?: string }) {
    try {
      const { startDate, endDate } = params;
      const where: any = { status: PaymentStatus.COMPLETED };
      if (startDate || endDate) {
        where.createdAt = {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {}),
        };
      }

      const totals = await prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true });

      return {
        totalRevenue: totals._sum.amount ?? 0,
        paymentsCount: totals._count,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get revenue analytics", 500);
    }
  }

  // Analytics: doctors
  static async doctorsAnalytics() {
    try {
      const [verified, unverified, active, inactive, bySpecialty] = await Promise.all([
        prisma.doctor.count({ where: { isVerified: true } }),
        prisma.doctor.count({ where: { isVerified: false } }),
        prisma.doctor.count({ where: { isActive: true } }),
        prisma.doctor.count({ where: { isActive: false } }),
        prisma.doctor.groupBy({ by: ['specialtyPrimary'], _count: { _all: true } }),
      ]);

      return {
        verified,
        unverified,
        active,
        inactive,
        bySpecialty: bySpecialty.map((g) => ({ specialty: g.specialtyPrimary, count: g._count._all })),
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get doctors analytics", 500);
    }
  }

  // Audit logs query
  static async getAuditLogs(params: {
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const { userId, action, entityType, startDate, endDate, page = 1, limit = 20 } = params;
      const where: any = {
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        }),
      ]);

      return { total, page, limit, items };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to get audit logs", 500);
    }
  }
}

