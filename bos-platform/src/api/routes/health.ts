import { Router, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { MetricsCollector } from '../../utils/MetricsCollector';
import { CircuitBreaker } from '../../utils/CircuitBreaker';

const route = Router();

export default (app: Router) => {
  app.use('/health', route);

  const metricsCollector = Container.get(MetricsCollector);

  // Basic liveness probe
  route.get('/', (req: any, res: Response) => {
    return res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Readiness probe with dependency checks
  route.get('/ready', async (req: any, res: Response, next: NextFunction) => {
    try {
      const checks: Record<string, any> = {};
      let isReady = true;

      // Check MongoDB connection
      try {
        const mongoose = await import('mongoose');
        if (mongoose.connection.readyState === 1) {
          checks.mongodb = 'up';
        } else {
          checks.mongodb = 'down';
          isReady = false;
        }
      } catch (e) {
        checks.mongodb = 'error';
        isReady = false;
      }

      // Check Circuit Breakers
      const breakers = ['stripe_api', 'email_service', 'sms_service'];
      checks.circuitBreakers = breakers.reduce((acc, name) => {
        try {
          const breaker = new CircuitBreaker(name);
          acc[name] = breaker.isOpen() ? 'open' : 'closed';
        } catch {
          acc[name] = 'unknown';
        }
        return acc;
      }, {} as Record<string, string>);

      const status = isReady ? 'ready' : 'not_ready';
      const statusCode = isReady ? 200 : 503;

      return res.status(statusCode).json({
        status,
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      return next(e);
    }
  });

  // Deep health check with metrics
  route.get('/deep', async (req: any, res: Response, next: NextFunction) => {
    try {
      const summary = metricsCollector.getSummary();
      
      const checks: Record<string, any> = {
        mongodb: 'unknown',
        circuitBreakers: {},
      };

      // MongoDB check
      try {
        const mongoose = await import('mongoose');
        checks.mongodb = mongoose.connection.readyState === 1 ? 'up' : 'down';
      } catch {
        checks.mongodb = 'error';
      }

      // Circuit Breakers
      const breakers = ['stripe_api', 'email_service', 'sms_service'];
      breakers.forEach(name => {
        try {
          const breaker = new CircuitBreaker(name);
          checks.circuitBreakers[name] = breaker.getState();
        } catch {
          checks.circuitBreakers[name] = { state: 'unknown' };
        }
      });

      const overallStatus = checks.mongodb === 'up' ? 'healthy' : 'unhealthy';

      return res.status(overallStatus === 'healthy' ? 200 : 503).json({
        status: overallStatus,
        checks,
        metrics: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      return next(e);
    }
  });

  // Metrics endpoint
  route.get('/metrics', (req: any, res: Response, next: NextFunction) => {
    try {
      const allMetrics = metricsCollector.getAllMetrics();
      const metricsArray = Array.from(allMetrics.values());

      return res.status(200).json({
        metrics: metricsArray,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      return next(e);
    }
  });
};
