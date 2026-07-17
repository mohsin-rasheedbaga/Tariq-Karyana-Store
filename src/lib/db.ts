import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// v1.3.3 FIX: Create PrismaClient with explicit SQLite pragmas for reliability.
// - journal_mode=WAL: allows concurrent readers + 1 writer (eliminates most "database is locked" errors)
// - busy_timeout=5000: wait up to 5s for a lock instead of failing instantly
// - foreign_keys=ON: enforce FK constraints (matches Prisma schema expectations)
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

export const db = globalForPrisma.prisma || createPrismaClient();

// Cache in global for both dev and production (Electron runs a single process)
globalForPrisma.prisma = db;

/**
 * v1.3.3 FIX: Apply SQLite performance/reliability pragmas.
 * Called once after DB schema is ensured. WAL mode + busy_timeout
 * dramatically reduce "database is locked" errors under concurrent load.
 */
export async function applySqlitePragmas(): Promise<void> {
  try {
    await db.$executeRawUnsafe('PRAGMA journal_mode=WAL');
    await db.$executeRawUnsafe('PRAGMA busy_timeout=5000');
    await db.$executeRawUnsafe('PRAGMA foreign_keys=ON');
    await db.$executeRawUnsafe('PRAGMA synchronous=NORMAL');
  } catch (e: any) {
    console.warn('[DB] Pragma warning (non-fatal):', e.message?.slice(0, 100));
  }
}
