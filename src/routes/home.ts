import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  serializeMatch,
  serializeNews,
  serializeTournament,
} from '../lib/serializers.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [live, featuredMatches, upcoming, completed, news, tournaments] =
    await Promise.all([
      prisma.match.findMany({
        where: { published: true, status: 'LIVE' },
        include: { tournament: true, photos: true },
        orderBy: { startAt: 'desc' },
      }),
      prisma.match.findMany({
        where: { published: true, featured: true },
        include: { tournament: true, photos: true },
        orderBy: { startAt: 'desc' },
        take: 10,
      }),
      prisma.match.findMany({
        where: { published: true, status: 'UPCOMING' },
        include: { tournament: true, photos: true },
        orderBy: { startAt: 'asc' },
        take: 20,
      }),
      prisma.match.findMany({
        where: { published: true, status: 'COMPLETED' },
        include: { tournament: true, photos: true },
        orderBy: { startAt: 'desc' },
        take: 20,
      }),
      prisma.news.findMany({
        where: { published: true },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      }),
      prisma.tournament.findMany({
        where: { published: true },
        orderBy: { startDate: 'desc' },
      }),
    ]);

  res.json({
    liveNow: live.map(serializeMatch),
    featured: featuredMatches.map(serializeMatch),
    upcoming: upcoming.map(serializeMatch),
    completed: completed.map(serializeMatch),
    latestNews: news.map(serializeNews),
    tournaments: tournaments.map(serializeTournament),
  });
});

export default router;
