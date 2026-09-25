import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { serializeMatch, serializeTournament } from '../lib/serializers.js';

const router = Router();

router.get('/', async (_req, res) => {
  const tournaments = await prisma.tournament.findMany({
    where: { published: true },
    orderBy: { startDate: 'desc' },
  });
  res.json({ tournaments: tournaments.map(serializeTournament) });
});

router.get('/:id', async (req, res) => {
  const tournament = await prisma.tournament.findFirst({
    where: { id: req.params.id, published: true },
  });
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found.' });
  }
  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id, published: true },
    include: { tournament: true, photos: true },
    orderBy: { startAt: 'asc' },
  });
  return res.json({
    tournament: serializeTournament(tournament),
    matches: matches.map(serializeMatch),
  });
});

export default router;
