import { Request, Response, NextFunction } from "express";
import { RoleType } from "@prisma/client";

export const authorizeRoles = (...allowedRoles: RoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user; // injected by authGuard
    
    console.log(user);
    if (!user || !user.roles) {
      return res.status(403).json({ message: "Access denied" });
    }

    const hasRole = allowedRoles.includes(user.roles);
    if (!hasRole) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
};
