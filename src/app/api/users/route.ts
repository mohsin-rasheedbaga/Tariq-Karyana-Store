import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';

export async function POST(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const { username, password, fullName, role, permissions } = await request.json();
    if (!username || !password || !fullName) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    const user = await db.user.create({
      data: { username, password, fullName, role: role || 'cashier', permissions: permissions || '{}' },
    });
    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: { id: true, username: true, fullName: true, role: true, permissions: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const { id, username, fullName, role, isActive, password, permissions, currentPassword } = await request.json();
    
    // If currentPassword is provided, verify it first (for self password change)
    if (currentPassword && password) {
      const existingUser = await db.user.findUnique({ where: { id } });
      if (!existingUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (existingUser.password !== currentPassword) {
        return NextResponse.json({ error: 'Current password is wrong' }, { status: 403 });
      }
    }
    
    // Check username uniqueness if changing
    if (username) {
      const existing = await db.user.findUnique({ where: { username } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      }
    }
    
    const data: Record<string, any> = {};
    if (username) data.username = username;
    if (fullName) data.fullName = fullName;
    if (role) data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (password) data.password = password;
    if (permissions !== undefined) data.permissions = permissions;
    
    const user = await db.user.update({ where: { id }, data });
    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}