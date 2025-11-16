import express from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import { AdminController } from './admin.controller';

const router = express.Router();
const adminOnly = [authenticateJWT, authorizeRoles('ADMIN' as any)];

// Dashboard
router.get('/dashboard/stats', ...adminOnly, AdminController.getDashboardStats);

// Doctor approvals
router.get('/doctors/pending', ...adminOnly, AdminController.getPendingDoctors);
router.post('/doctors/:doctorId/approve', ...adminOnly, AdminController.approveDoctor);
router.post('/doctors/:doctorId/reject', ...adminOnly, AdminController.rejectDoctor);

// Users management
router.get('/users', ...adminOnly, AdminController.listUsers);
router.post('/users/:userId/suspend', ...adminOnly, AdminController.suspendUser);
router.post('/users/:userId/reactivate', ...adminOnly, AdminController.reactivateUser);

// Analytics
router.get('/analytics/consultations', ...adminOnly, AdminController.consultationsAnalytics);
router.get('/analytics/revenue', ...adminOnly, AdminController.revenueAnalytics);
router.get('/analytics/doctors', ...adminOnly, AdminController.doctorsAnalytics);

router.get('/audit-logs', ...adminOnly, AdminController.getAuditLogs);

export default router;

