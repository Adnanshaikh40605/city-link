import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = { userId: req.userId! };
  const [total, rows] = await Promise.all([
    prisma.watchHistory.count({ where }),
    prisma.watchHistory.findMany({
      where,
      orderBy: { watchedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return res.json({
    data: rows.map((r) => ({
      id: r.id,
      contentId: r.contentId,
      contentType: r.contentType === 'MATCH' ? 'match' : 'news',
      title: r.title,
      thumbnailUrl: r.thumbnail,
      watchedAt: r.watchedAt.toISOString(),
    })),
    page,
    limit,
    total,
    hasMore: skip + rows.length < total,
  });
});

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    contentType: z.enum(['match', 'news', 'MATCH', 'NEWS']),
    contentId: z.string().min(1),
    title: z.string().min(1),
    thumbnailUrl: z.string().optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid watch history payload.' });
  }

  const contentType =
    parsed.data.contentType.toUpperCase() === 'NEWS' ? 'NEWS' : 'MATCH';

  const row = await prisma.watchHistory.upsert({
    where: {
      userId_contentType_contentId: {
        userId: req.userId!,
        contentType,
        contentId: parsed.data.contentId,
      },
    },
    create: {
      userId: req.userId!,
      contentType,
      contentId: parsed.data.contentId,
      title: parsed.data.title,
      thumbnail: parsed.data.thumbnailUrl,
    },
    update: {
      title: parsed.data.title,
      thumbnail: parsed.data.thumbnailUrl,
      watchedAt: new Date(),
    },
  });

  return res.status(201).json({
    item: {
      id: row.id,
      contentId: row.contentId,
      contentType: row.contentType === 'MATCH' ? 'match' : 'news',
      title: row.title,
      thumbnailUrl: row.thumbnail,
      watchedAt: row.watchedAt.toISOString(),
    },
  });
});

export default router;
