import type { Match, MatchStatus, News, Photo, Tournament } from '@prisma/client';

type MatchWithRelations = Match & {
  tournament?: Pick<Tournament, 'id' | 'name'> | null;
  photos?: Photo[];
};

const statusMap: Record<MatchStatus, string> = {
  UPCOMING: 'upcoming',
  LIVE: 'live',
  COMPLETED: 'completed',
};

export function serializeTournament(t: Tournament) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    thumbnailUrl: t.thumbnail,
    thumbnail: t.thumbnail,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    featured: t.featured,
    published: t.published,
    status:
      t.endDate < new Date()
        ? 'completed'
        : t.startDate > new Date()
          ? 'upcoming'
          : 'live',
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializePhoto(p: Photo) {
  return {
    id: p.id,
    matchId: p.matchId,
    imageUrl: p.imageUrl,
    caption: p.caption,
    sortOrder: p.sortOrder,
    published: p.published,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeMatch(m: MatchWithRelations) {
  const photos = (m.photos ?? [])
    .filter((p) => p.published)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(serializePhoto);

  return {
    id: m.id,
    tournamentId: m.tournamentId,
    tournamentName: m.tournament?.name ?? '',
    teamA: m.teamA,
    teamB: m.teamB,
    startAt: m.startAt.toISOString(),
    date: m.startAt.toISOString(),
    time: m.startAt.toISOString(),
    venue: m.venue,
    thumbnailUrl: m.thumbnail,
    thumbnail: m.thumbnail,
    description: m.description,
    status: statusMap[m.status],
    youtubeId: m.youtubeVideoId,
    youtubeVideoId: m.youtubeVideoId,
    featured: m.featured,
    published: m.published,
    photos,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export function serializeNews(n: News) {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    thumbnailUrl: n.thumbnail,
    thumbnail: n.thumbnail,
    youtubeId: n.youtubeVideoId,
    youtubeVideoId: n.youtubeVideoId,
    publishedAt: n.publishedAt.toISOString(),
    featured: n.featured,
    published: n.published,
    status: n.published ? 'published' : 'unpublished',
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}
