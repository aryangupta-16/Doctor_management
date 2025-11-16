import { Router } from 'express';
import AvailabilityController from './availability.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';

const router = Router();

// Public
router.post('/schedule',authenticateJWT,authorizeRoles('DOCTOR'), AvailabilityController.createSchedule);
router.get('/schedule',authenticateJWT,authorizeRoles('DOCTOR'), AvailabilityController.getSchedule); 

// Protected
router.put('/schedule/:scheduleId', authenticateJWT, authorizeRoles('DOCTOR'), AvailabilityController.updateSchedule);
router.delete('/schedule/:scheduleId', authenticateJWT, authorizeRoles('DOCTOR'), AvailabilityController.deleteSchedule);
router.post('/slots/generate', authenticateJWT, authorizeRoles('DOCTOR'), AvailabilityController.generateSlots);
router.get('/slots',authenticateJWT,authorizeRoles('DOCTOR'), AvailabilityController.getSlots)

router.post('/block',authenticateJWT,authorizeRoles('DOCTOR'),AvailabilityController.blockSlots)

router.get('/doctor/:doctorId',AvailabilityController.getDoctorSlots)
export default router;
