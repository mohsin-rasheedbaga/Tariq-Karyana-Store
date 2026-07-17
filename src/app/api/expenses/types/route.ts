import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const types = await db.expenseType.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error('Error fetching expense types:', error);
    return NextResponse.json({ error: 'Failed to fetch expense types' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const body = await request.json();

    const type = await db.expenseType.create({
      data: {
        name: body.name,
      },
    });

    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error('Error creating expense type:', error);
    return NextResponse.json({ error: 'Failed to create expense type' }, { status: 500 });
  }
}