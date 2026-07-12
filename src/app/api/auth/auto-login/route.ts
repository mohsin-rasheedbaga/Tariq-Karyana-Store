import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SCHEMA_SQL } from '@/lib/schema-sql';

let schemaChecked = false;

async function ensureSchema() {
  if (schemaChecked) return;
  schemaChecked = true;

  try {
    await db.user.count();
  } catch (error: any) {
    if (error.code === 'P2021') {
      console.log('[DB] Tables missing, creating schema...');
      const statements = SCHEMA_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const sql of statements) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (e: any) {
          if (!e.message?.includes('already exists')) {
            console.warn('[DB] Statement warning:', e.message?.slice(0, 100));
          }
        }
      }
      console.log('[DB] Schema created successfully.');
    } else {
      console.error('[DB] Unexpected error checking tables:', error.message || error);
      schemaChecked = false;
      throw error;
    }
  }
}

async function ensureAdminUser() {
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
    throw error;
  }
}

export async function POST() {
  try {
    await ensureSchema();
    await ensureAdminUser();

    const user = await db.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      return NextResponse.json({ error: 'No active user found' }, { status: 404 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const { password: _, ...safeUser } = user;
    return NextResponse.json({
      user: safeUser,
      token: Buffer.from(`${user.id}:${Date.now()}`).toString('base64'),
    });
  } catch (error) {
    console.error('Auto-login error:', error);
    return NextResponse.json({ error: 'Server error', detail: String(error) }, { status: 500 });
  }
}