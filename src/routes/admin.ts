import { Router } from 'express';
import { z } from 'zod';
import { MatchStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  serializeMatchAdmin,
  serializeNews,
  serializePhoto,
  serializeTournament,
} from '../lib/serializers.js';
import { publicUser } from '../lib/auth.js';
import { parsePageLimit, pageMeta } from '../lib/pagination.js';
import {
  requireAuth,
  requireAdmin,
  type AuthedRequest,
} from '../middleware/auth.js';
import { filePublicUrl, imageUpload } from '../lib/uploads.js';

/**
 * Phase 3 Admin APIs — all routes require an active ADMIN role.
 */
const router = Router();
router.use(requireAuth, requireAdmin);

const matchStatusSchema = z.enum(['UPCOMING', 'LIVE', 'COMPLETED']);
const boolFromQuery = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

router.get('/health', (_req, res) => {
  res.json({ ok: true, scope: 'admin', phase: 3 });
});

router.get('/dashboard', async (_req, res) => {
  const [
    totalTournaments,
    upcomingMatches,
    liveMatches,
    completedMatches,
    publishedNews,
    totalUsers,
  ] = await Promise.all([
    prisma.tournament.count(),
    prisma.match.count({ where: { status: 'UPCOMING' } }),
    prisma.match.count({ where: { status: 'LIVE' } }),
    prisma.match.count({ where: { status: 'COMPLETED' } }),
    prisma.news.count({ where: { published: true } }),
    prisma.user.count(),
  ]);

  return res.json({
    totals: {
      tournaments: totalTournaments,
      upcomingMatches,
      liveMatches,
      completedMatches,
      publishedNews,
      users: totalUsers,
    },
  });
});

// ??? Tournaments ?????????????????????????????????????????????????????????????

router.get('/tournaments', async (req, res) => {
  const { page, limit, skip } = parsePageLimit(req.query as Record<string, unknown>);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const published = boolFromQuery(req.query.published);
  const featured = boolFromQuery(req.query.featured);

  const where: Prisma.TournamentWhereInput = {
    ...(published === undefined ? {} : { published }),
    ...(featured === undefined ? {} : { featured }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.tournament.count({ where }),
    prisma.tournament.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip,
      take: limit,
      include: { _count: { select: { matches: true } } },
    }),
  ]);

  return res.json({
    data: rows.map((t) => ({
      ...serializeTournament(t),
      matchCount: t._count.matches,
    })),
    ...pageMeta(total, page, limit),
  });
});

router.get('/tournaments/:id', async (req, res) => {
  const t = await prisma.tournament.findUnique({
    where: { id: req.params.id },
    include: {
      matches: {
        orderBy: { startAt: 'desc' },
        include: { photos: true, tournament: true },
      },
    },
  });
  if (!t) return res.status(404).json({ error: 'Tournament not found.' });
  return res.json({
    tournament: {
      ...serializeTournament(t),
      matches: t.matches.map((m) =>
        serializeMatchAdmin(m),
      ),
    },
  });
});

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

router.delete('/tournaments/:id', async (req, res) => {
  try {
    await prisma.tournament.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ error: 'Tournament not found.' });
  }
});

// ??? Matches ?????????????????????????????????????????????????????????????????

router.get('/matches', async (req, res) => {
  const { page, limit, skip } = parsePageLimit(req.query as Record<string, unknown>);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const published = boolFromQuery(req.query.published);
  const featured = boolFromQuery(req.query.featured);
  const tournamentId =
    typeof req.query.tournamentId === 'string' ? req.query.tournamentId : undefined;
  const statusRaw =
    typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
  const status = matchStatusSchema.safeParse(statusRaw);

  const where: Prisma.MatchWhereInput = {
    ...(published === undefined ? {} : { published }),
    ...(featured === undefined ? {} : { featured }),
    ...(tournamentId ? { tournamentId } : {}),
    ...(status.success ? { status: status.data } : {}),
    ...(q
      ? {
          OR: [
            { teamA: { contains: q, mode: 'insensitive' } },
            { teamB: { contains: q, mode: 'insensitive' } },
            { venue: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy: { startAt: 'desc' },
      skip,
      take: limit,
      include: {
        tournament: true,
        photos: true,
        _count: { select: { photos: true } },
      },
    }),
  ]);

  return res.json({
    data: rows.map((m) => ({
      ...serializeMatchAdmin(m),
      photoCount: m._count.photos,
    })),
    ...pageMeta(total, page, limit),
  });
});

router.get('/matches/:id', async (req, res) => {
  const m = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: { tournament: true, photos: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!m) return res.status(404).json({ error: 'Match not found.' });
  return res.json({
    match: serializeMatchAdmin(m),
  });
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
  return res.status(201).json({
    match: serializeMatchAdmin(m),
  });
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
  if (parsed.data.tournamentId) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parsed.data.tournamentId },
    });
    if (!tournament) {
      return res.status(400).json({ error: 'Tournament not found.' });
    }
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
    return res.json({
      match: serializeMatchAdmin(m),
    });
  } catch {
    return res.status(404).json({ error: 'Match not found.' });
  }
});

router.delete('/matches/:id', async (req, res) => {
  try {
    await prisma.match.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ error: 'Match not found.' });
  }
});

// ??? Photos ??????????????????????????????????????????????????????????????????

router.get('/photos', async (req, res) => {
  const { page, limit, skip } = parsePageLimit(req.query as Record<string, unknown>);
  const matchId =
    typeof req.query.matchId === 'string' ? req.query.matchId : undefined;
  const published = boolFromQuery(req.query.published);

  const where: Prisma.PhotoWhereInput = {
    ...(matchId ? { matchId } : {}),
    ...(published === undefined ? {} : { published }),
  };

  const [total, rows] = await Promise.all([
    prisma.photo.count({ where }),
    prisma.photo.findMany({
      where,
      orderBy: [{ matchId: 'asc' }, { sortOrder: 'asc' }],
      skip,
      take: limit,
      include: {
        match: { select: { id: true, teamA: true, teamB: true, status: true } },
      },
    }),
  ]);

  return res.json({
    data: rows.map((p) => ({
      ...serializePhoto(p),
      matchTitle: `${p.match.teamA} vs ${p.match.teamB}`,
      matchStatus: p.match.status,
    })),
    ...pageMeta(total, page, limit),
  });
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

router.patch('/photos/:id', async (req, res) => {
  const schema = z.object({
    imageUrl: z.string().url().optional(),
    caption: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    published: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid photo update.' });
  }
  try {
    const photo = await prisma.photo.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    return res.json({ photo: serializePhoto(photo) });
  } catch {
    return res.status(404).json({ error: 'Photo not found.' });
  }
});

router.delete('/photos/:id', async (req, res) => {
  try {
    await prisma.photo.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ error: 'Photo not found.' });
  }
});

// ??? News ????????????????????????????????????????????????????????????????????

router.get('/news', async (req, res) => {
  const { page, limit, skip } = parsePageLimit(req.query as Record<string, unknown>);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const published = boolFromQuery(req.query.published);
  const featured = boolFromQuery(req.query.featured);

  const where: Prisma.NewsWhereInput = {
    ...(published === undefined ? {} : { published }),
    ...(featured === undefined ? {} : { featured }),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.news.count({ where }),
    prisma.news.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return res.json({
    data: rows.map(serializeNews),
    ...pageMeta(total, page, limit),
  });
});

router.get('/news/:id', async (req, res) => {
  const item = await prisma.news.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'News not found.' });
  return res.json({ news: serializeNews(item) });
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

router.delete('/news/:id', async (req, res) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch {
    return res.status(404).json({ error: 'News not found.' });
  }
});

// ??? Users ???????????????????????????????????????????????????????????????????

router.get('/users', async (req, res) => {
  const { page, limit, skip } = parsePageLimit(req.query as Record<string, unknown>);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status =
    typeof req.query.status === 'string' && req.query.status
      ? req.query.status
      : undefined;
  const role =
    typeof req.query.role === 'string' &&
    (req.query.role === 'USER' || req.query.role === 'ADMIN')
      ? req.query.role
      : undefined;

  const where: Prisma.UserWhereInput = {
    ...(status ? { status } : {}),
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return res.json({
    data: rows.map(publicUser),
    ...pageMeta(total, page, limit),
  });
});

router.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const watchCount = await prisma.watchHistory.count({
    where: { userId: user.id },
  });
  return res.json({
    user: {
      ...publicUser(user),
      watchHistoryCount: watchCount,
    },
  });
});

router.patch('/users/:id', async (req: AuthedRequest, res) => {
  const schema = z.object({
    status: z.enum(['active', 'disabled']).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    name: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid user update.' });
  }

  const userId = String(req.params.id);
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  // Prevent locking yourself out of the only admin account via this endpoint.
  if (
    req.userId === existing.id &&
    ((parsed.data.role && parsed.data.role !== 'ADMIN') ||
      parsed.data.status === 'disabled')
  ) {
    return res.status(400).json({
      error: 'You cannot disable your own admin account or remove your admin role.',
    });
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  return res.json({ user: publicUser(user) });
});

// ??? Uploads ?????????????????????????????????????????????????????????????????

router.post('/uploads', (req, res) => {
  imageUpload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof Error ? err.message : 'Could not upload image.';
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Choose an image file to upload.' });
    }
    const url = filePublicUrl(req, req.file.filename);
    return res.status(201).json({
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

export default router;
