import { Router } from 'express';
import ConsultationController from './consultation.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';

const router = Router();

// Protected routes
router.post('/book', authenticateJWT, authorizeRoles('PATIENT'), ConsultationController.bookConsultation);
router.get('/my', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), ConsultationController.getMyConsultations);
router.get('/:id', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), ConsultationController.getConsultationById);
router.post('/:id/cancel', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), ConsultationController.cancelConsultation);
router.post('/:id/reschedule', authenticateJWT, authorizeRoles('PATIENT', 'DOCTOR'), ConsultationController.rescheduleConsultation);

// Booking endpoints
router.post('/:id/start', authenticateJWT, authorizeRoles('DOCTOR'), ConsultationController.startConsultation);
router.post('/:id/complete', authenticateJWT, authorizeRoles('DOCTOR'), ConsultationController.completeConsultation);
router.patch('/:id/notes', authenticateJWT, authorizeRoles('DOCTOR'),ConsultationController.updateConsultationNotes);
export default router;
