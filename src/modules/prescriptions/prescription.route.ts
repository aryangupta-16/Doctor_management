import { Router } from 'express';
import PrescriptionController from './prescription.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// Protected routes
router.post('/', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(PrescriptionController.createPrescription));
router.patch('/:id', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(PrescriptionController.updatePrescription));
router.delete('/:id', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(PrescriptionController.deletePrescription));

router.get('/my',authenticateJWT, asyncHandler(PrescriptionController.getMyPrescription));
router.get('/:id',authenticateJWT, asyncHandler(PrescriptionController.getPrescriptionById));
router.get('/consultation/:consultationId',authenticateJWT, asyncHandler(PrescriptionController.getPrescriptionByConsultationId));

router.get('/:id/download',authenticateJWT, asyncHandler(PrescriptionController.downloadPrescription));

export default router;
