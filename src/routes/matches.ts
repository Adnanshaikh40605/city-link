import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { serializeMatch, serializePhoto } from '../lib/serializers.js';

const router = Router();

router.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: {
    published: boolean;
    status?: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  } = { published: true };

  if (status === 'UPCOMING' || status === 'LIVE' || status === 'COMPLETED') {
    where.status = status;
  }

  const [total, matches] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      include: { tournament: true, photos: true },
      orderBy: { startAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: matches.map(serializeMatch),
    page,
    limit,
    total,
    hasMore: skip + matches.length < total,
  });
});

router.get('/:id', async (req, res) => {
  const match = await prisma.match.findFirst({
    where: { id: req.params.id, published: true },
    include: { tournament: true, photos: true },
  });
  if (!match) {
    return res.status(404).json({ error: 'Match not found.' });
  }
  return res.json({ match: serializeMatch(match) });
});

router.get('/:id/photos', async (req, res) => {
  const match = await prisma.match.findFirst({
    where: { id: req.params.id, published: true },
  });
  if (!match) {
    return res.status(404).json({ error: 'Match not found.' });
  }
  const photos = await prisma.photo.findMany({
    where: { matchId: match.id, published: true },
    orderBy: { sortOrder: 'asc' },
  });
  return res.json({ photos: photos.map(serializePhoto) });
});

export default router;
