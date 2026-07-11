import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient();

// Cache in global for both dev and production (Electron runs a single process)
globalForPrisma.prisma = db;