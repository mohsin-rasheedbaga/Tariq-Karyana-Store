import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { username, password, fullName, role } = await request.json();
    if (!username || !password || !fullName) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    const user = await db.user.create({
      data: { username, password, fullName, role: role || 'cashier' },
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
      select: { id: true, username: true, fullName: true, role: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, fullName, role, isActive, password } = await request.json();
    const data: Record<string, any> = {};
    if (fullName) data.fullName = fullName;
    if (role) data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (password) data.password = password;
    const user = await db.user.update({ where: { id }, data });
    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}