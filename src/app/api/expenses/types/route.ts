import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    await ensureDatabase();
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
    await ensureDatabase();
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