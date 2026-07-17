import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// v1.3.3 FIX: Keep construction simple — let Prisma read DATABASE_URL from the
// environment automatically (same as the original). We previously tried to pass
// `datasources.db.url` explicitly, but process.env.DATABASE_URL is undefined
// during `next build`, which made Prisma throw PrismaClientConstructorValidationError
// and broke the production build.
//
// SQLite reliability pragmas (WAL mode, busy_timeout, foreign_keys) are applied
// at runtime in db-init.ts → applySqlitePragmasSafe(), which is the correct place.
export const db = globalForPrisma.prisma || new PrismaClient();

// Cache in global for both dev and production (Electron runs a single process)
globalForPrisma.prisma = db;
