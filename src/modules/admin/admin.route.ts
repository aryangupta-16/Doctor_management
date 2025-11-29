import express from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import { AdminController } from './admin.controller';
import { asyncHandler } from '../../utils/asyncHandler';

const router = express.Router();
const adminOnly = [authenticateJWT, authorizeRoles('ADMIN' as any)];

// Dashboard
router.get('/dashboard/stats', ...adminOnly, asyncHandler(AdminController.getDashboardStats));

// Doctor approvals
router.get('/doctors/pending', ...adminOnly, asyncHandler(AdminController.getPendingDoctors));
router.post('/doctors/:doctorId/approve', ...adminOnly, asyncHandler(AdminController.approveDoctor));
router.post('/doctors/:doctorId/reject', ...adminOnly, asyncHandler(AdminController.rejectDoctor));

// Users management
router.get('/users', ...adminOnly, asyncHandler(AdminController.listUsers));
router.post('/users/:userId/suspend', ...adminOnly, asyncHandler(AdminController.suspendUser));
router.post('/users/:userId/reactivate', ...adminOnly, asyncHandler(AdminController.reactivateUser));

// Analytics
router.get('/analytics/consultations', ...adminOnly, asyncHandler(AdminController.consultationsAnalytics));
router.get('/analytics/revenue', ...adminOnly, asyncHandler(AdminController.revenueAnalytics));
router.get('/analytics/doctors', ...adminOnly, asyncHandler(AdminController.doctorsAnalytics));

router.get('/audit-logs', ...adminOnly, asyncHandler(AdminController.getAuditLogs));

export default router;

