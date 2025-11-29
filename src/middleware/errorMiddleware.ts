import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

// Global error handling middleware
export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  const isAppError = err instanceof AppError;

  const statusCode = isAppError && err.statusCode ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';
  const status = isAppError ? err.status : 'error';

  if (process.env.NODE_ENV !== 'production') {
    // Basic logging; you already have a logger if you want to plug it in
    // console.error(err);
  }

  res.status(statusCode).json({ status, message });
}
