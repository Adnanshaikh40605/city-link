import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import homeRoutes from './routes/home.js';
import liveRoutes from './routes/live.js';
import matchesRoutes from './routes/matches.js';
import tournamentsRoutes from './routes/tournaments.js';
import newsRoutes from './routes/news.js';
import profileRoutes from './routes/profile.js';
import watchHistoryRoutes from './routes/watchHistory.js';
import adminRoutes from './routes/admin.js';
import showsRoutes from './routes/shows.js';
import { UPLOAD_DIR } from './lib/uploads.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'city-link-api', phase: 3 });
  });

  app.use('/auth', authRoutes);
  app.use('/home', homeRoutes);
  app.use('/live', liveRoutes);
  app.use('/matches', matchesRoutes);
  app.use('/tournaments', tournamentsRoutes);
  app.use('/news', newsRoutes);
  app.use('/profile', profileRoutes);
  app.use('/watch-history', watchHistoryRoutes);
  app.use('/shows', showsRoutes);
  app.use('/admin', adminRoutes);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({ error: 'Internal server error.' });
    },
  );

  return app;
}
