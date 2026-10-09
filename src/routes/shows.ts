import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res) => {
  const category =
    typeof req.query.category === 'string'
      ? req.query.category.toUpperCase()
      : undefined;
  const allowed = new Set(['EVENTS', 'PODCAST', 'FILMS', 'EDUCATION']);
  const rows = await prisma.show.findMany({
    where: {
      published: true,
      ...(category && allowed.has(category)
        ? { category: category as 'EVENTS' | 'PODCAST' | 'FILMS' | 'EDUCATION' }
        : {}),
    },
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
  });
  return res.json({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category.toLowerCase(),
      videoSource: row.videoSource,
      youtubeId: row.youtubeVideoId,
      videoFileUrl: row.videoFileUrl,
      thumbnailUrl: row.thumbnail,
      duration: row.duration,
      views: row.views,
      featured: row.featured,
      publishedAt: row.publishedAt.toISOString(),
    })),
  });
});

export default router;
