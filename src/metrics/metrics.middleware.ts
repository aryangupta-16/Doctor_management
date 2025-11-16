import {Request,Response,NextFunction} from 'express'
import {metricsService} from './metrics.service'

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = metricsService.httpRequestDuration.startTimer();

  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      statusCode: res.statusCode,
    });
  });

  next();
}