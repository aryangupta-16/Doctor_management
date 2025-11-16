// src/modules/doctors/doctor.routes.ts
import { Router } from 'express';
import { DoctorController } from './doctor.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';

const router = Router();

router.get('/:doctorId', DoctorController.getDoctorById);

router.put('/:doctorId', authenticateJWT, authorizeRoles('ADMIN', 'DOCTOR'), DoctorController.updateDoctorProfile);

router.put('/me', authenticateJWT, authorizeRoles('DOCTOR'), DoctorController.updateDoctorProfile);

router.get('/me', authenticateJWT, authorizeRoles('DOCTOR'), DoctorController.getOwnDoctorProfile);

export default router;
