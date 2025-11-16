import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";

export function signAccessToken(payload: object) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiry as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: object) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiry as SignOptions["expiresIn"],
  });
}

export function signEmailToken(payload: object) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtEmailVerifExpiry as SignOptions["expiresIn"],
  });
}

export function signResetToken(payload: object) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtResetPwdExpiry as SignOptions["expiresIn"],
  });
}

export function verifyToken<T = any>(token: string): T {
  return jwt.verify(token, config.jwtSecret) as T;
}
