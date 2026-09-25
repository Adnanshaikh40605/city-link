import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'city link',
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const cricketGround =
  'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1200&q=80';
const stadiumNight =
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80';
const batsman =
  'https://images.unsplash.com/photo-1593766787879-e8c78e090dca?auto=format&fit=crop&w=1200&q=80';
const crowd =
  'https://images.unsplash.com/photo-1624526267942-ab0ff8ce3e07?auto=format&fit=crop&w=1200&q=80';
const newsStudio =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';
const newsMic =
  'https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?auto=format&fit=crop&w=1200&q=80';

async function main() {
  console.log('Seeding City Link Phase 2 test data...');

  await prisma.watchHistory.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.match.deleteMany();
  await prisma.news.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password', 10);

  const testUser = await prisma.user.create({
    data: {
      name: 'Demo User',
      email: 'demo@citylink.app',
      passwordHash,
      role: 'USER',
    },
  });

  await prisma.user.create({
    data: {
      name: 'City Link Admin',
      email: 'admin@citylink.app',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  });

  const now = new Date();

  const t1 = await prisma.tournament.create({
    data: {
      name: 'City Link Premier Cup 2026',
      description:
        'City Links flagship T20 tournament. Watch live streams and match replays on YouTube, plus match-day photos.',
      thumbnail: stadiumNight,
      startDate: new Date(now.getTime() - 4 * 86400000),
      endDate: new Date(now.getTime() + 18 * 86400000),
      featured: true,
      published: true,
    },
  });

  const t2 = await prisma.tournament.create({
    data: {
      name: 'Aurangabad T20 Series',
      description:
        'Regional T20 cricket hosted in Aurangabad. Completed and upcoming fixtures are organised under this tournament.',
      thumbnail: cricketGround,
      startDate: new Date(now.getTime() - 30 * 86400000),
      endDate: new Date(now.getTime() + 5 * 86400000),
      published: true,
    },
  });

  const live = await prisma.match.create({
    data: {
      tournamentId: t1.id,
      teamA: 'City Warriors',
      teamB: 'Link Riders',
      startAt: new Date(now.getTime() - 42 * 60000),
      venue: 'City Link Stadium, Aurangabad',
      thumbnail: stadiumNight,
      description:
        'Live T20 clash. City Link is streaming this match on YouTube. Open Watch Live for the official broadcast.',
      status: 'LIVE',
      youtubeVideoId: 'M7lc1UVf-VE',
      featured: true,
      published: true,
      photos: {
        create: [
          {
            imageUrl: cricketGround,
            caption: 'Toss and opening overs',
            sortOrder: 0,
          },
          {
            imageUrl: batsman,
            caption: 'City Warriors batting',
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.match.create({
    data: {
      tournamentId: t1.id,
      teamA: 'Aurangabad Kings',
      teamB: 'Pune Titans',
      startAt: new Date(now.getTime() + 27 * 3600000),
      venue: 'MIDC Ground, Aurangabad',
      thumbnail: cricketGround,
      description:
        'Upcoming Premier Cup fixture. Match details are available now. The YouTube stream will appear when the match goes live.',
      status: 'UPCOMING',
      featured: true,
      published: true,
    },
  });

  await prisma.match.create({
    data: {
      tournamentId: t2.id,
      teamA: 'Strikers XI',
      teamB: 'Royals XI',
      startAt: new Date(now.getTime() + 77 * 3600000),
      venue: 'Sports Complex, Aurangabad',
      thumbnail: crowd,
      description:
        'T20 series fixture. Check back when the match is live to watch on City Link.',
      status: 'UPCOMING',
      published: true,
    },
  });

  const done1 = await prisma.match.create({
    data: {
      tournamentId: t1.id,
      teamA: 'India A',
      teamB: 'Bangladesh A',
      startAt: new Date(now.getTime() - 53 * 3600000),
      venue: 'City Link Stadium, Aurangabad',
      thumbnail: batsman,
      description:
        'Completed match. Watch the official replay and browse match photos from the ground.',
      status: 'COMPLETED',
      youtubeVideoId: 'aqz-KE-bpKQ',
      featured: true,
      published: true,
      photos: {
        create: [
          { imageUrl: batsman, caption: 'Opening stand', sortOrder: 0 },
          { imageUrl: stadiumNight, caption: 'Night session', sortOrder: 1 },
          {
            imageUrl: crowd,
            caption: 'Crowd at City Link Stadium',
            sortOrder: 2,
          },
          { imageUrl: cricketGround, caption: 'Presentation', sortOrder: 3 },
        ],
      },
    },
  });

  await prisma.match.create({
    data: {
      tournamentId: t2.id,
      teamA: 'Nashik Blasters',
      teamB: 'Jalna Knights',
      startAt: new Date(now.getTime() - 6 * 86400000),
      venue: 'Divisional Ground, Aurangabad',
      thumbnail: crowd,
      description:
        'Replay available. This completed match also includes a photo gallery from the venue.',
      status: 'COMPLETED',
      youtubeVideoId: 'jNQXAC9IVRw',
      published: true,
      photos: {
        create: [
          {
            imageUrl: crowd,
            caption: 'Match highlights still',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.match.create({
    data: {
      tournamentId: t2.id,
      teamA: 'Demo XI',
      teamB: 'Unavailable XI',
      startAt: new Date(now.getTime() - 8 * 86400000),
      venue: 'Practice Ground, Aurangabad',
      thumbnail: cricketGround,
      description:
        'Demo fixture used to show the unavailable-video state. The YouTube ID is invalid on purpose.',
      status: 'COMPLETED',
      youtubeVideoId: 'not-a-real-id',
      published: true,
    },
  });

  await prisma.news.createMany({
    data: [
      {
        title: 'City Warriors take control in Premier Cup opener',
        description:
          'A recap of the live City Link Premier Cup match, bowling changes, and what to watch in the next fixture.',
        thumbnail: newsMic,
        youtubeVideoId: 'M7lc1UVf-VE',
        publishedAt: new Date(now.getTime() - 3 * 3600000),
        featured: true,
        published: true,
      },
      {
        title: 'Aurangabad T20 Series: weekend fixtures announced',
        description:
          'Dates, venues and streaming notes for the next round of the Aurangabad T20 Series on City Link.',
        thumbnail: newsStudio,
        youtubeVideoId: 'aqz-KE-bpKQ',
        publishedAt: new Date(now.getTime() - 86400000),
        published: true,
      },
      {
        title: 'How City Link will stream live cricket this season',
        description:
          'City Link uses YouTube for live and replay delivery. This clip explains where to find matches, photos and news.',
        thumbnail: stadiumNight,
        youtubeVideoId: 'jNQXAC9IVRw',
        publishedAt: new Date(now.getTime() - 2 * 86400000),
        published: true,
      },
    ],
  });

  await prisma.watchHistory.create({
    data: {
      userId: testUser.id,
      contentType: 'MATCH',
      contentId: done1.id,
      title: `${done1.teamA} vs ${done1.teamB}`,
      thumbnail: done1.thumbnail,
      watchedAt: new Date(now.getTime() - 3600000),
    },
  });

  console.log('Seed complete.');
  console.log('Test user: demo@citylink.app / password');
  console.log('Admin user: admin@citylink.app / admin123');
  console.log(`Live match id: ${live.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
