import dotenv from "dotenv";
dotenv.config();

export const config = {
  PORT: process.env.PORT || 8000,
  DATABASE_URL: process.env.DATABASE_URL!,
  NODE_ENV: process.env.NODE_ENV || "development",
  
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  jwtEmailVerifExpiry: process.env.JWT_EMAIL_VERIF_EXPIRY || '1d',
  jwtResetPwdExpiry: process.env.JWT_RESET_PASSWORD_EXPIRY || '1h',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM,
  },

  redisUrl: process.env.REDIS_URL,

  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
};
