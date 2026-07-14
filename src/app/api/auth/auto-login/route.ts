import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureDatabase, ensureAdminUser, ensureProductsSeeded } from '@/lib/db-init';

export async function POST() {
  try {
    // Use shared DB initialization
    await ensureDatabase();
    await ensureAdminUser();
    await ensureProductsSeeded();

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