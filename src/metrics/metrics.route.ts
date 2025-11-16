// src/metrics/metrics.route.ts
import { Router } from 'express';
import { metricsService } from './metrics.service';

const router = Router();

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsService.getRegistry().contentType);
  res.send(await metricsService.metrics());
});

export default router;
