import prisma from '../../prisma/client';
import { AuditAction, ConsultationStatus, PaymentStatus, RoleType } from '@prisma/client';

export class AdminService {
  // Dashboard statistics
  static async getDashboardStats() {
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
  }

  // Doctors approval flows
  static async getPendingDoctors() {
    return prisma.doctor.findMany({
      where: { isVerified: false },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async approveDoctor(doctorId: string, adminUserId: string) {
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
  }

  static async rejectDoctor(doctorId: string, adminUserId: string, reason: string) {
    // Keep isVerified = false; record audit with reason
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
  }

  // Users list with filters
  static async listUsers(params: {
    role?: RoleType;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
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
  }

  static async suspendUser(userId: string, adminUserId: string, reason?: string) {
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
  }

  static async reactivateUser(userId: string, adminUserId: string) {
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
  }

  // Analytics: consultations
  static async consultationAnalytics(params: {
    startDate?: string;
    endDate?: string;
    speciality?: string;
  }) {
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

    // If speciality is not provided, give a breakdown by specialty
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
  }

  // Analytics: revenue
  static async revenueAnalytics(params: { startDate?: string; endDate?: string }) {
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
  }

  // Analytics: doctors
  static async doctorsAnalytics() {
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
  }
}

