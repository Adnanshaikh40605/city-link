import { Router } from 'express';
import { z } from 'zod';
import { MatchStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  serializeMatch,
  serializeNews,
  serializePhoto,
  serializeTournament,
} from '../lib/serializers.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

/**
 * Phase 3 Admin foundation  APIs only, no Admin UI in Phase 2.
 * All routes require ADMIN role.
 */
const router = Router();
router.use(requireAuth, requireAdmin);

const matchStatusSchema = z.enum(['UPCOMING', 'LIVE', 'COMPLETED']);

router.post('/tournaments', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    description: z.string().optional().default(''),
    thumbnail: z.string().optional().default(''),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    featured: z.boolean().optional().default(false),
    published: z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid tournament payload.' });
  }
  const t = await prisma.tournament.create({
    data: {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });
  return res.status(201).json({ tournament: serializeTournament(t) });
});

router.patch('/tournaments/:id', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    featured: z.boolean().optional(),
    published: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid tournament update.' });
  }
  try {
    const t = await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        startDate: parsed.data.startDate
          ? new Date(parsed.data.startDate)
          : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      },
    });
    return res.json({ tournament: serializeTournament(t) });
  } catch {
    return res.status(404).json({ error: 'Tournament not found.' });
  }
});

router.post('/matches', async (req, res) => {
  const schema = z.object({
    tournamentId: z.string().min(1),
    teamA: z.string().min(1),
    teamB: z.string().min(1),
    startAt: z.string().datetime(),
    venue: z.string().optional().default(''),
    thumbnail: z.string().optional().default(''),
    description: z.string().optional().default(''),
    status: matchStatusSchema.optional().default('UPCOMING'),
    youtubeVideoId: z.string().nullable().optional(),
    featured: z.boolean().optional().default(false),
    published: z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid match payload.' });
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id: parsed.data.tournamentId },
  });
  if (!tournament) {
    return res.status(400).json({ error: 'Tournament not found.' });
  }
  const m = await prisma.match.create({
    data: {
      ...parsed.data,
      startAt: new Date(parsed.data.startAt),
      status: parsed.data.status as MatchStatus,
    },
    include: { tournament: true, photos: true },
  });
  return res.status(201).json({ match: serializeMatch(m) });
});

router.patch('/matches/:id', async (req, res) => {
  const schema = z.object({
    teamA: z.string().min(1).optional(),
    teamB: z.string().min(1).optional(),
    startAt: z.string().datetime().optional(),
    venue: z.string().optional(),
    thumbnail: z.string().optional(),
    description: z.string().optional(),
    status: matchStatusSchema.optional(),
    youtubeVideoId: z.string().nullable().optional(),
    featured: z.boolean().optional(),
    published: z.boolean().optional(),
    tournamentId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid match update.' });
  }
  try {
    const m = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
        status: parsed.data.status as MatchStatus | undefined,
      },
      include: { tournament: true, photos: true },
    });
    return res.json({ match: serializeMatch(m) });
  } catch {
    return res.status(404).json({ error: 'Match not found.' });
  }
});

router.post('/matches/:id/photos', async (req, res) => {
  const schema = z.object({
    imageUrl: z.string().url(),
    caption: z.string().nullable().optional(),
    sortOrder: z.number().int().optional().default(0),
    published: z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid photo payload.' });
  }
  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) {
    return res.status(404).json({ error: 'Match not found.' });
  }
  const photo = await prisma.photo.create({
    data: { matchId: match.id, ...parsed.data },
  });
  return res.status(201).json({ photo: serializePhoto(photo) });
});

router.post('/news', async (req, res) => {
  const schema = z.object({
    title: z.string().min(2),
    description: z.string().optional().default(''),
    thumbnail: z.string().optional().default(''),
    youtubeVideoId: z.string().nullable().optional(),
    publishedAt: z.string().datetime().optional(),
    featured: z.boolean().optional().default(false),
    published: z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid news payload.' });
  }
  const item = await prisma.news.create({
    data: {
      ...parsed.data,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : new Date(),
    },
  });
  return res.status(201).json({ news: serializeNews(item) });
});

router.patch('/news/:id', async (req, res) => {
  const schema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    youtubeVideoId: z.string().nullable().optional(),
    publishedAt: z.string().datetime().optional(),
    featured: z.boolean().optional(),
    published: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid news update.' });
  }
  try {
    const item = await prisma.news.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        publishedAt: parsed.data.publishedAt
          ? new Date(parsed.data.publishedAt)
          : undefined,
      },
    });
    return res.json({ news: serializeNews(item) });
  } catch {
    return res.status(404).json({ error: 'News not found.' });
  }
});

router.get('/health', (_req, res) => {
  res.json({ ok: true, scope: 'admin' });
});

export default router;
