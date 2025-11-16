import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';
import {RoleType} from "@prisma/client"

export interface AuthRequest extends Request {
  user?: { sub: string; role?: RoleType};
}

export async function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: 'Missing Authorization header' });
  const parts = h.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Invalid Authorization format' });
  const token = parts[1];
  try {
    const payload = verifyToken(token) as jwt.JwtPayload;

    req.user = payload as any;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
