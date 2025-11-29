// src/modules/doctors/doctor.routes.ts
import { Router } from 'express';
import { DoctorController } from './doctor.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.put('/me', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(DoctorController.updateDoctorProfile));

router.get('/me', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(DoctorController.getOwnDoctorProfile));

router.get('/:doctorId', asyncHandler(DoctorController.getDoctorById));

router.put('/:doctorId', authenticateJWT, authorizeRoles('ADMIN', 'DOCTOR'), asyncHandler(DoctorController.updateDoctorProfile));


export default router;
