import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // v1.3.5 FIX: Ensure DB is ready on GET too (safety net if auto-login init failed).
    await ensureDbReady();
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
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const body = await request.json();

    // v1.3.5 FIX: Auto-create a default "General" expense type if none provided.
    // Schema requires expenseTypeId (non-null). Previously, sending null caused
    // PrismaClientValidationError -> 500. Now we ensure a valid type always exists.
    let expenseTypeId = body.expenseTypeId;
    if (!expenseTypeId) {
      let generalType = await db.expenseType.findFirst({ where: { name: 'General' } });
      if (!generalType) {
        generalType = await db.expenseType.create({ data: { name: 'General' } });
      }
      expenseTypeId = generalType.id;
    }

    const expense = await db.expense.create({
      data: {
        expenseTypeId,
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