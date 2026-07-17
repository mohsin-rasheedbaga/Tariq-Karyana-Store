import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureDatabase, ensureAdminUser, ensureProductsSeeded, ensureSettings } from '@/lib/db-init';

export async function POST() {
  try {
    // Step 1: Ensure DB schema (fast, idempotent — skips if already initialized)
    await ensureDatabase();

    // Step 2: Ensure admin user exists (fast)
    await ensureAdminUser();

    // v1.3.3 FIX: Ensure a default Settings row exists. Without this, sales,
    // purchases, and returns all fail because they need Settings for invoice numbers.
    await ensureSettings();

    // Step 3: Find user FIRST (before slow seed)
    let user = null;
    try {
      user = await db.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    } catch (e: any) {
      console.error('[AutoLogin] User query failed:', e.message?.slice(0, 100));
    }

    // Step 4: Return user immediately — don't block on seeding
    if (user) {
      const { password: _, ...safeUser } = user;
      try {
        await db.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });
      } catch {}

      const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

      // Seed products in background (non-blocking)
      ensureProductsSeeded().catch(e => console.error('[AutoLogin] Background seed error:', e.message?.slice(0, 100)));

      return NextResponse.json({ user: safeUser, token });
    }

    // Fallback: if no user found but admin creation succeeded, try again
    return NextResponse.json({ error: 'No active user found' }, { status: 500 });
  } catch (error: any) {
    console.error('[AutoLogin] Fatal error:', error.message?.slice(0, 200));
    return NextResponse.json({ error: 'Server error', detail: error.message?.slice(0, 200) }, { status: 500 });
  }
}
