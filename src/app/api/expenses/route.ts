import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const expenses = await db.expense.findMany({
      where: {
        ...(from && to
          ? {
              createdAt: {
                gte: new Date(from),
                lte: new Date(to),
              },
            }
          : {}),
      },
      include: {
        expenseType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = await request.json();

    const expense = await db.expense.create({
      data: {
        expenseTypeId: body.expenseTypeId,
        amount: body.amount,
        description: body.description || null,
      },
      include: {
        expenseType: true,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}