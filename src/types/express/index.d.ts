import { JwtPayload } from 'jsonwebtoken';
import { RoleType } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        sub: string;
        email?: string;
        role?: RoleType;
        doctorID?: String;
      };
    }
  }
}