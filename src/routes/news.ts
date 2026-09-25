import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { serializeNews } from '../lib/serializers.js';

const router = Router();

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = { published: true };
  const [total, news] = await Promise.all([
    prisma.news.count({ where }),
    prisma.news.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: news.map(serializeNews),
    page,
    limit,
    total,
    hasMore: skip + news.length < total,
  });
});

router.get('/:id', async (req, res) => {
  const item = await prisma.news.findFirst({
    where: { id: req.params.id, published: true },
  });
  if (!item) {
    return res.status(404).json({ error: 'News item not found.' });
  }
  return res.json({ news: serializeNews(item) });
});

export default router;
