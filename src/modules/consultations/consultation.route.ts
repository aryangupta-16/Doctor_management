import { Router } from 'express';
import ConsultationController from './consultation.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// Protected routes
router.post('/book', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.bookConsultation));
router.get('/my', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.getMyConsultations));
router.get('/:id', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.getConsultationById));
router.post('/:id/cancel', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.cancelConsultation));
router.post('/:id/reschedule', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), asyncHandler(ConsultationController.rescheduleConsultation));

// Booking endpoints
router.post('/:id/start', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.startConsultation));
router.post('/:id/complete', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.completeConsultation));
router.patch('/:id/notes', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(ConsultationController.updateConsultationNotes));
export default router;
