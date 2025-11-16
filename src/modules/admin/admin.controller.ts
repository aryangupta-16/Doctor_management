import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { AuditAction } from '@prisma/client';

export class AdminController {
  // GET /dashboard/stats
  static async getDashboardStats(req: Request, res: Response) {
    const stats = await AdminService.getDashboardStats();
    return res.json({ success: true, data: stats });
  }

  // GET /doctors/pending
  static async getPendingDoctors(req: Request, res: Response) {
    const list = await AdminService.getPendingDoctors();
    return res.json({ success: true, data: list });
  }

  // POST /doctors/:doctorId/approve
  static async approveDoctor(req: Request, res: Response) {
    const { doctorId } = req.params;
    const adminId = (req as any).user?.sub ?? '';
    const result = await AdminService.approveDoctor(doctorId, adminId);
    return res.json({ success: true, data: result });
  }

  // POST /doctors/:doctorId/reject
  static async rejectDoctor(req: Request, res: Response) {
    const { doctorId } = req.params;
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ message: 'reason is required' });
    const adminId = (req as any).user?.sub ?? '';
    const result = await AdminService.rejectDoctor(doctorId, adminId, reason);
    return res.json({ success: true, data: result });
  }

  // GET /users
  static async listUsers(req: Request, res: Response) {
    const { role, isActive, search } = req.query as any;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const result = await AdminService.listUsers({
      role: role as any,
      isActive: typeof isActive !== 'undefined' ? isActive === 'true' : undefined,
      search: search as string,
      page,
      limit,
    });
    return res.json({ success: true, ...result });
  }

  // POST /users/:userId/suspend
  static async suspendUser(req: Request, res: Response) {
    const { userId } = req.params;
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ message: 'reason is required' });
    const adminId = (req as any).user?.sub ?? '';
    const user = await AdminService.suspendUser(userId, adminId, reason);
    return res.json({ success: true, data: user });
  }

  // POST /users/:userId/reactivate
  static async reactivateUser(req: Request, res: Response) {
    const { userId } = req.params;
    const adminId = (req as any).user?.sub ?? '';
    const user = await AdminService.reactivateUser(userId, adminId);
    return res.json({ success: true, data: user });
  }

  // GET /analytics/consultations
  static async consultationsAnalytics(req: Request, res: Response) {
    const { startDate, endDate, speciality } = req.query as any;
    const data = await AdminService.consultationAnalytics({ startDate, endDate, speciality });
    return res.json({ success: true, data });
  }

  // GET /analytics/revenue
  static async revenueAnalytics(req: Request, res: Response) {
    const { startDate, endDate } = req.query as any;
    const data = await AdminService.revenueAnalytics({ startDate, endDate });
    return res.json({ success: true, data });
  }

  // GET /analytics/doctors
  static async doctorsAnalytics(req: Request, res: Response) {
    const data = await AdminService.doctorsAnalytics();
    return res.json({ success: true, data });
  }

  // GET /audit-logs
  static async getAuditLogs(req: Request, res: Response) {
    const { userId, action } = req.query as any;
    const entityType = (req.query['entityType'] || req.query['entity-type']) as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const data = await AdminService.getAuditLogs({
      userId: userId as string | undefined,
      action: action as AuditAction | undefined,
      entityType,
      startDate,
      endDate,
      page,
      limit,
    });
    return res.json({ success: true, ...data });
  }
}

