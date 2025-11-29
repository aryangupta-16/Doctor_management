import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  registerDoctor
} from './auth.controller';
import { validateRequest } from '../../utils/validation';
import { asyncHandler } from '../../utils/asyncHandler';

const router = express.Router();

/** Auth routes */
router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  validateRequest,
  asyncHandler(register)
);

router.post('/register-doctor',
    body('email').isEmail(),
    body('password').isLength({min : 8}),
    validateRequest,
    asyncHandler(registerDoctor)
)

router.post('/login',
  body('email').isEmail(),
  body('password').exists(),
  validateRequest,
  asyncHandler(login)
);

router.post('/refresh',
  body('refreshToken').exists(),
  validateRequest,
  asyncHandler(refresh)
);

router.post('/logout',
  body('refreshToken').exists(),
  validateRequest,
  asyncHandler(logout)
);

router.post('/forgot-password',
  body('email').isEmail(),
  validateRequest,
  asyncHandler(forgotPassword)
);

router.post('/reset-password',
  body('token').exists(),
  body('newPassword').isLength({ min: 8 }),
  validateRequest,
  asyncHandler(resetPassword)
);

router.get('/verify-email', asyncHandler(verifyEmail as any));

router.post('/resend-verification',
  body('email').isEmail(),
  validateRequest,
  asyncHandler(resendVerification)
);

export default router;
