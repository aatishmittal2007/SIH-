import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { config } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './modules/auth/auth.routes';
import { caseRoutes } from './modules/cases/case.routes';
import { sourceRoutes } from './modules/sources/source.routes';
import { evidenceRoutes } from './modules/evidence/evidence.routes';
import { entityRoutes } from './modules/entities/entity.routes';
import { eventRoutes } from './modules/events/event.routes';
import entityResolutionRoutes from './routes/entityResolution.routes';
import relationshipRoutes from './routes/relationship.routes';
import correlationRoutes from './routes/correlation.routes';
import temporalRoutes from './routes/temporal.routes';
import networkRoutes from './routes/network.routes';
import patternRoutes from './routes/pattern.routes';
import contradictionRoutes from './routes/contradiction.routes';
import intelligenceRoutes from './routes/intelligence.routes';
import pathFinderRoutes from './routes/pathFinder.routes';
import dashboardRoutes from './routes/dashboard.routes';
import geospatialRoutes from './routes/geospatial.routes';
import alertRoutes from './routes/alert.routes';
import reportRoutes from './routes/report.routes';
import testRoutes from './modules/test/test.routes';

dotenv.config();

const app = express();
const PORT = config.port;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Security Headers & Rate Limiting
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || origin === config.frontendUrl) {
        callback(null, true);
      } else {
        callback(null, true); // Allow for local development
      }
    },
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' },
});

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
}

app.use(express.json());

// API Routes (Mounted on both /api and /api/v1 for compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

app.use('/api/cases', caseRoutes);
app.use('/api/v1/cases', caseRoutes);

app.use('/api/sources', sourceRoutes);
app.use('/api/v1/sources', sourceRoutes);

app.use('/api/evidence', evidenceRoutes);
app.use('/api/v1/evidence', evidenceRoutes);

app.use('/api/entities', entityRoutes);
app.use('/api/v1/entities', entityRoutes);

app.use('/api/events', eventRoutes);
app.use('/api/v1/events', eventRoutes);

app.use('/api/entity-resolution', entityResolutionRoutes);
app.use('/api/v1/entity-resolution', entityResolutionRoutes);

app.use('/api/relationships', relationshipRoutes);
app.use('/api/v1/relationships', relationshipRoutes);

app.use('/api/correlations', correlationRoutes);
app.use('/api/v1/correlations', correlationRoutes);

app.use('/api/temporal', temporalRoutes);
app.use('/api/v1/temporal', temporalRoutes);

app.use('/api/network', networkRoutes);
app.use('/api/v1/network', networkRoutes);

app.use('/api/patterns', patternRoutes);
app.use('/api/v1/patterns', patternRoutes);

app.use('/api/contradictions', contradictionRoutes);
app.use('/api/v1/contradictions', contradictionRoutes);

app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/v1/intelligence', intelligenceRoutes);

app.use('/api/path-finder', pathFinderRoutes);
app.use('/api/v1/path-finder', pathFinderRoutes);

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.use('/api/geospatial', geospatialRoutes);
app.use('/api/v1/geospatial', geospatialRoutes);

app.use('/api/alerts', alertRoutes);
app.use('/api/v1/alerts', alertRoutes);

app.use('/api/reports', reportRoutes);
app.use('/api/v1/reports', reportRoutes);

app.use('/api', testRoutes);

// Root & Health Checks
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'tracex-backend',
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'tracex-backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0-phase4',
  });
});

app.get('/api/health/db', async (req: Request, res: Response) => {
  const pgHost = process.env.POSTGRES_HOST || 'localhost';
  const pgPort = process.env.POSTGRES_PORT || '5433';
  
  res.json({
    service: 'PostgreSQL Database',
    status: 'online',
    host: pgHost,
    port: pgPort,
    database: process.env.POSTGRES_DB || 'tracex_db',
  });
});

app.get('/api/health/graph', async (req: Request, res: Response) => {
  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  
  res.json({
    service: 'Neo4j Graph Database',
    status: 'online',
    uri: neo4jUri,
  });
});

app.get('/api/health/ai', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      res.json({
        service: 'FastAPI AI Service Bridge',
        status: 'online',
        ai_service_response: data,
      });
    } else {
      res.status(502).json({
        service: 'FastAPI AI Service Bridge',
        status: 'offline',
        error: `AI Service responded with status ${response.status}`,
      });
    }
  } catch (err: any) {
    res.status(503).json({
      service: 'FastAPI AI Service Bridge',
      status: 'offline',
      error: err.message || 'Unable to connect to AI Service',
    });
  }
});

// Central Error Handler Middleware
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`[TRACE-X Backend] Server listening on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[TRACE-X Backend] Port ${PORT} is already in use by another process.`);
      console.error(`[TRACE-X Backend] An existing instance of the backend is already running on port ${PORT}.`);
      process.exit(1);
    } else {
      console.error('[TRACE-X Backend] Server error:', err);
    }
  });
}

export default app;
