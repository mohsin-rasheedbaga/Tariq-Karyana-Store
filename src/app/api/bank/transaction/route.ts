import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    const transactions = await db.bankTransaction.findMany({
      where: {
        ...(accountId ? { bankAccountId: accountId } : {}),
      },
      include: {
        bankAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch bank transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const { bankAccountId, type, amount, description } = body;

    if (type !== 'deposit' && type !== 'draw') {
      return NextResponse.json({ error: 'Type must be deposit or draw' }, { status: 400 });
    }

    // Create transaction and update balance in a transaction
    const transaction = await db.$transaction(async (tx) => {
      // Get current account
      const account = await tx.bankAccount.findUnique({
        where: { id: bankAccountId },
      });

      if (!account) {
        throw new Error('Bank account not found');
      }

      if (type === 'draw' && account.balance < amount) {
        throw new Error('Insufficient balance');
      }

      const balanceChange = type === 'deposit' ? amount : -amount;

      // Create transaction
      const newTransaction = await tx.bankTransaction.create({
        data: {
          bankAccountId,
          type,
          amount,
          description: description || null,
        },
        include: {
          bankAccount: true,
        },
      });

      // Update account balance
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: { increment: balanceChange } },
      });

      return newTransaction;
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating bank transaction:', error);
    const message = error instanceof Error ? error.message : 'Failed to create bank transaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}