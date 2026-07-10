import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SCHEMA_SQL } from '@/lib/schema-sql';

let initialized = false;

async function ensureDatabase() {
  if (initialized) return;

  try {
    // Check if User table exists by trying a simple count
    await db.user.count();
  } catch (error: any) {
    if (error.code === 'P2021') {
      // Tables don't exist - create them using raw SQL
      console.log('[DB] Tables missing, creating schema...');
      // Execute each statement separately (SQLite doesn't support multiple statements)
      const statements = SCHEMA_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const sql of statements) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (e: any) {
          // Ignore "already exists" errors
          if (!e.message?.includes('already exists')) {
            console.warn('[DB] Statement warning:', e.message?.slice(0, 100));
          }
        }
      }
      console.log('[DB] Schema created successfully.');
    } else {
      throw error;
    }
  }

  // Create default admin if no users exist
  try {
    const count = await db.user.count();
    if (count === 0) {
      await db.user.create({
        data: {
          username: 'admin',
          password: 'admin123',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          permissions: JSON.stringify({
            dashboard: true, sales: true, products: true,
            purchases: true, customers: true, expenses: true,
            reports: true, users: true, settings: true, bank: true,
            stock: true, categories: true, units: true, groups: true, party: true,
          }),
        },
      });
      console.log('[DB] Default admin created (admin / admin123)');
    }
  } catch (error) {
    console.error('[DB] Failed to create admin:', error);
  }

  initialized = true;
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();

    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { username } });
    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }
    if (!user.isActive) {
      return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
    }
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    const { password: _, ...safeUser } = user;
    return NextResponse.json({
      user: safeUser,
      token: Buffer.from(`${user.id}:${Date.now()}`).toString('base64')
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server error', detail: String(error) }, { status: 500 });
  }
}