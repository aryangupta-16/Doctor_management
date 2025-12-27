// src/modules/users/user.routes.ts
import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../common/middlewares/roleGuard';
import {
  getMe, updateMe, uploadProfilePicture, changePassword, deleteMe, getUserById, adminDeleteUserById
} from './user.controller';
import { asyncHandler } from '../../utils/asyncHandler';

const router = express.Router();

// simple multer temp storage to tmp folder; UserService moves file to uploads dir
// const upload = multer({ dest: 'tmp/' });

// GET /users/me
router.get('/me', authenticateJWT, asyncHandler(getMe));

// GET /users/:id
router.get('/:id', authenticateJWT, asyncHandler(getUserById));

// PUT /users/me
router.put('/me', authenticateJWT, asyncHandler(updateMe));

// POST /users/me/profile-picture
// router.post('/me/profile-picture', authenticateJWT, upload.single('file'), uploadProfilePicture);

// POST /users/me/change-password
router.post('/me/change-password', authenticateJWT, asyncHandler(changePassword));

// DELETE /users/me
router.delete('/me', authenticateJWT, asyncHandler(deleteMe));

// Admin delete user by id
router.delete('/:id', authenticateJWT, authorizeRoles('ADMIN'), asyncHandler(adminDeleteUserById));

export default router;
