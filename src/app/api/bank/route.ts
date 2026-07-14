import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    await ensureDatabase();
    const accounts = await db.bankAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch bank accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = await request.json();

    const account = await db.bankAccount.create({
      data: {
        bankName: body.bankName,
        branchName: body.branchName || null,
        accountNo: body.accountNo || null,
        phone: body.phone || null,
        balance: body.balance ?? 0,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 });
  }
}