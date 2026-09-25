import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    let connection = connectionString;
    let sslmode: string | null = null;
    try {
      const url = new URL(connectionString);
      sslmode = url.searchParams.get('sslmode');
      url.searchParams.delete('sslmode');
      connection = url.toString();
    } catch {
      connection = connectionString
        .replace(/([?&])sslmode=[^&]*/g, '$1')
        .replace(/[?&]$/, '');
    }
    const internal = connectionString.includes('railway.internal');
    const local =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1');
    const useSsl = !local && !internal && sslmode !== 'disable';
    return new Pool({
      connectionString: connection,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'city link',
  });
}

export const pool = globalForPrisma.pgPool ?? createPool();

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
