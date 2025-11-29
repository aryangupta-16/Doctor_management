import { Router } from 'express';
import AvailabilityController from './availability.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// Public
router.post('/schedule',authenticateJWT,authorizeRoles('DOCTOR'), asyncHandler(AvailabilityController.createSchedule));
router.get('/schedule',authenticateJWT,authorizeRoles('DOCTOR'), asyncHandler(AvailabilityController.getSchedule)); 

// Protected
router.put('/schedule/:scheduleId', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(AvailabilityController.updateSchedule));
router.delete('/schedule/:scheduleId', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(AvailabilityController.deleteSchedule));
router.post('/slots/generate', authenticateJWT, authorizeRoles('DOCTOR'), asyncHandler(AvailabilityController.generateSlots));
router.get('/slots',authenticateJWT,authorizeRoles('DOCTOR'), asyncHandler(AvailabilityController.getSlots));

router.post('/block',authenticateJWT,authorizeRoles('DOCTOR'), asyncHandler(AvailabilityController.blockSlots));

router.get('/doctor/:doctorId', asyncHandler(AvailabilityController.getDoctorSlots));
export default router;
