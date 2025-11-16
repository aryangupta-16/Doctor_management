// src/modules/users/user.routes.ts
import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import {
  getMe, updateMe, uploadProfilePicture, changePassword, deleteMe, adminDeleteUserById
} from './user.controller';

const router = express.Router();

// simple multer temp storage to tmp folder; UserService moves file to uploads dir
// const upload = multer({ dest: 'tmp/' });

// GET /users/me
router.get('/me', authenticateJWT, getMe);

// PUT /users/me
router.put('/me', authenticateJWT, updateMe);

// POST /users/me/profile-picture
// router.post('/me/profile-picture', authenticateJWT, upload.single('file'), uploadProfilePicture);

// POST /users/me/change-password
router.post('/me/change-password', authenticateJWT, changePassword);

// DELETE /users/me
router.delete('/me', authenticateJWT, deleteMe);

// Admin delete user by id
router.delete('/:id', authenticateJWT, authorizeRoles('ADMIN'), adminDeleteUserById);

export default router;
