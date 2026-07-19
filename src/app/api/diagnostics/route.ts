import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { db, dbInitError, testDbConnection } from '@/lib/db';

/**
 * v1.3.8 DIAGNOSTIC ENDPOINT
 *
 * Returns a comprehensive report of the database/Prisma state so we can see
 * the EXACT error on the user's machine. The frontend calls this when the
 * dashboard fails and displays the report for the user to copy and send.
 *
 * This endpoint is safe to call at any time — it never throws.
 */
export async function GET() {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    version: 'v1.3.8',
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cwd: process.cwd(),
  };

  // 1. Environment variables
  report.env = {
    DATABASE_URL: process.env.DATABASE_URL || '(not set)',
    NODE_ENV: process.env.NODE_ENV || '(not set)',
    PORT: process.env.PORT || '(not set)',
    ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE || '(not set)',
  };

  // 2. Parse the DATABASE_URL to find the actual DB file path
  const dbUrl = process.env.DATABASE_URL || '';
  let dbFilePath = '';
  if (dbUrl.startsWith('file:')) {
    // file:///C:/Users/.../custom.db  or  file:./db/custom.db
    dbFilePath = dbUrl.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '/').replace(/^file:\.\//, '');
    if (!path.isAbsolute(dbFilePath) && !dbFilePath.startsWith('/')) {
      dbFilePath = path.resolve(process.cwd(), dbFilePath);
    }
  }
  report.dbFilePath = dbFilePath;
  report.dbFileExists = dbFilePath ? fs.existsSync(dbFilePath) : false;
  if (report.dbFileExists) {
    try {
      const stat = fs.statSync(dbFilePath);
      report.dbFileSize = stat.size;
      report.dbFileModified = stat.mtime.toISOString();
    } catch {}
  }

  // 3. PrismaClient initialization state
  report.prismaClient = {
    instanceCreated: db !== null,
    initError: dbInitError,
  };

  // 4. Find the Prisma engine binary
  const possibleEngineDirs = [
    path.join(process.cwd(), 'node_modules', '.prisma', 'client'),
    path.join(__dirname, '..', '..', '..', '..', 'node_modules', '.prisma', 'client'),
  ];
  report.prismaEngineSearch = [];
  for (const dir of possibleEngineDirs) {
    const entry: Record<string, any> = { dir, exists: fs.existsSync(dir) };
    if (entry.exists) {
      try {
        const files = fs.readdirSync(dir);
        entry.files = files;
        entry.engineFiles = files.filter(f => f.endsWith('.node') || f.endsWith('.dll.node'));
        entry.hasWindowsEngine = entry.engineFiles.some((f: string) => f.toLowerCase().includes('windows'));
      } catch (e: any) {
        entry.readError = e.message;
      }
    }
    report.prismaEngineSearch.push(entry);
  }

  // 5. Test the actual DB connection
  report.connectionTest = await testDbConnection();

  // 6. If connection works, check schema state
  if (report.connectionTest.ok && db) {
    try {
      const tables: any[] = await db.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );
      report.tables = tables.map((t: any) => t.name);
      report.tableCount = tables.length;
    } catch (e: any) {
      report.schemaCheckError = `${e?.code || ''} ${e?.message || String(e)}`;
    }

    // Try a simple count on each critical table
    if (report.tableCount > 0) {
      report.tableCounts = {};
      const criticalTables = ['User', 'Product', 'Customer', 'Sale', 'Settings', 'Expense', 'ExpenseType'];
      for (const table of criticalTables) {
        if (report.tables.includes(table)) {
          try {
            const r: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${table}"`);
            report.tableCounts[table] = r[0]?.c ?? '?';
          } catch (e: any) {
            report.tableCounts[table] = `ERROR: ${e?.message?.slice(0, 60) || String(e)}`;
          }
        }
      }
    }
  }

  // 7. Determine overall status
  let status = 'unknown';
  let criticalError = '';
  if (dbInitError) {
    status = 'PRISMA_INIT_FAILED';
    criticalError = dbInitError;
  } else if (!report.dbFileExists && dbFilePath) {
    status = 'DB_FILE_MISSING';
    criticalError = `Database file does not exist at: ${dbFilePath}`;
  } else if (!report.connectionTest.ok) {
    status = 'DB_CONNECTION_FAILED';
    criticalError = report.connectionTest.error || 'Unknown connection error';
  } else if (report.tableCount === 0) {
    status = 'DB_EMPTY_NO_TABLES';
    criticalError = 'Database file exists but has 0 tables — ensureDbReady() did not run or failed';
  } else {
    status = 'OK';
  }
  report.status = status;
  report.criticalError = criticalError;

  // v1.3.8: SQLite COUNT(*) returns BigInt which JSON.stringify cannot handle.
  // Convert any BigInt values to strings before serializing.
  const safeReport = JSON.parse(JSON.stringify(report, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));

  return NextResponse.json(safeReport, { status: 200 });
}
