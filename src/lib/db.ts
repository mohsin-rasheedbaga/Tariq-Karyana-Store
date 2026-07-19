import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | null;
  prismaInitError: string | null;
};

// v1.3.8 FIX: Capture Prisma initialization errors instead of letting them
// crash the module. Every API route imports `db`, so if `new PrismaClient()`
// throws (e.g. engine binary fails to load on Windows), EVERY route returns 500
// and the actual error is swallowed. Now we capture it in `dbInitError` so the
// diagnostics endpoint and API routes can surface the REAL error to the user.
let dbInstance: PrismaClient | null = null;
let initError: string | null = globalForPrisma.prismaInitError;

if (globalForPrisma.prisma) {
  dbInstance = globalForPrisma.prisma;
  initError = null;
} else if (!initError) {
  try {
    dbInstance = new PrismaClient({
      // Show full query errors in logs (helps debugging in production)
      log: [
        { emit: 'stdout', level: 'error' },
      ],
    });
    globalForPrisma.prisma = dbInstance;
    globalForPrisma.prismaInitError = null;
    initError = null;
  } catch (e: any) {
    initError = `PrismaClient initialization failed: ${e?.message || String(e)}\n${e?.stack || ''}`;
    globalForPrisma.prismaInitError = initError;
    console.error('[DB] INIT ERROR:', initError);
  }
}

export const db = dbInstance;
export const dbInitError = initError;

/**
 * Test if the database connection actually works by running a trivial query.
 * Returns { ok: true } or { ok: false, error: '...' }.
 * Used by the /api/diagnostics endpoint.
 */
export async function testDbConnection(): Promise<{ ok: boolean; error?: string }> {
  if (dbInitError) return { ok: false, error: dbInitError };
  if (!dbInstance) return { ok: false, error: 'PrismaClient is null (init failed silently)' };
  try {
    await dbInstance.$queryRawUnsafe('SELECT 1 as ok');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `${e?.code || ''} ${e?.message || String(e)}` };
  }
}
