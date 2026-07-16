import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await db.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const customer = await db.customer.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        phone: body.phone ?? undefined,
        address: body.address ?? undefined,
        comments: body.comments ?? undefined,
        cardType: body.cardType ?? undefined,
        balance: body.balance ?? undefined,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await db.customer.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}

// POST /api/customers/[id] - Add balance (advance deposit)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { amount, description } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const customer = await db.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Create CashReceive record and update balance
    await db.$transaction(async (tx) => {
      await tx.cashReceive.create({
        data: {
          customerId: id,
          amount,
          description: description || 'Advance Deposit',
        },
      });
      await tx.customer.update({
        where: { id },
        data: { balance: { decrement: amount } }, // balance is debt, deposit reduces it
      });
    });

    const updated = await db.customer.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error adding balance:', error);
    return NextResponse.json({ error: 'Failed to add balance' }, { status: 500 });
  }
}