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

const router = express.Router();

/** Auth routes */
router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  validateRequest,
  register
);

router.post('/register-doctor',
    body('email').isEmail(),
    body('password').isLength({min : 8}),
    validateRequest,
    registerDoctor
)

router.post('/login',
  body('email').isEmail(),
  body('password').exists(),
  validateRequest,
  login
);

router.post('/refresh',
  body('refreshToken').exists(),
  validateRequest,
  refresh
);

router.post('/logout',
  body('refreshToken').exists(),
  validateRequest,
  logout
);

router.post('/forgot-password',
  body('email').isEmail(),
  validateRequest,
  forgotPassword
);

router.post('/reset-password',
  body('token').exists(),
  body('newPassword').isLength({ min: 8 }),
  validateRequest,
  resetPassword
);

router.get('/verify-email', verifyEmail);

router.post('/resend-verification',
  body('email').isEmail(),
  validateRequest,
  resendVerification
);

export default router;
