import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
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
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

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