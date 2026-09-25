import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { serializeMatch } from '../lib/serializers.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [live, upcoming] = await Promise.all([
    prisma.match.findMany({
      where: { published: true, status: 'LIVE' },
      include: { tournament: true, photos: true },
      orderBy: { startAt: 'desc' },
    }),
    prisma.match.findMany({
      where: { published: true, status: 'UPCOMING' },
      include: { tournament: true, photos: true },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  res.json({
    live: live.map(serializeMatch),
    upcoming: upcoming.map(serializeMatch),
  });
});

export default router;
