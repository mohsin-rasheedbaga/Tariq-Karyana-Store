import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const groups = await db.productGroup.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const body = await request.json();

    const group = await db.productGroup.create({
      data: {
        name: body.name,
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}