import { Router } from 'express';
import ConsultationController from './consultation.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// ====== BOOKING ENDPOINTS ======
router.post('/book', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.bookConsultation));
router.post('/:id/cancel', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.cancelConsultation));
router.post('/:id/reschedule', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.rescheduleConsultation));

// ====== DOCTOR ENDPOINTS ======
router.post('/:id/start', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.startConsultation));
router.post('/:id/complete', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.completeConsultation));
router.patch('/:id/notes', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.updateConsultationNotes));
router.get('/doctor/pending', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.getPendingConsultations));
router.get('/doctor/list', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.getDoctorConsultations));

// ====== PATIENT ENDPOINTS ======
router.get('/patient/list', authenticateJWT, authorizeRoles('PATIENT'), asyncHandler(ConsultationController.getPatientConsultations));

// ====== ADMIN ENDPOINTS ======
router.get('/admin/all', authenticateJWT, authorizeRoles('ADMIN'), asyncHandler(ConsultationController.getAllConsultations));

// ====== SHARED ENDPOINTS (PATIENT & DOCTOR) ======
router.get('/upcoming', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.getUpcomingConsultations));
router.get('/completed', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.getCompletedConsultations));

// ====== LEGACY ENDPOINTS (kept for backward compatibility) ======
router.get('/my', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.getMyConsultations));
router.get('/:id', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.getConsultationById));
export default router;
