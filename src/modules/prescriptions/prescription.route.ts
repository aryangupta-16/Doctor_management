import { Router } from 'express';
import PrescriptionController from './prescription.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';

const router = Router();

// Protected routes
router.post('/', authenticateJWT, authorizeRoles('DOCTOR'), PrescriptionController.createPrescription);
router.patch('/:id', authenticateJWT, authorizeRoles('DOCTOR'), PrescriptionController.updatePrescription);
router.delete('/:id', authenticateJWT, authorizeRoles('DOCTOR'), PrescriptionController.deletePrescription);

router.get('/my',authenticateJWT,PrescriptionController.getMyPrescription);
router.get('/:id',authenticateJWT,PrescriptionController.getPrescriptionById);
router.get('/consultation/:consultationId',authenticateJWT,PrescriptionController.getPrescriptionByConsultationId)

router.get('/:id/download',authenticateJWT,PrescriptionController.downloadPrescription)

export default router;
