import { db } from '@/lib/db';
import { generateCustomerBarcode } from '@/lib/barcode';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const customers = await db.customer.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { phone: { contains: search } },
                { barcode: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const barcode = body.barcode || generateCustomerBarcode();

    const customer = await db.customer.create({
      data: {
        barcode,
        name: body.name,
        phone: body.phone || null,
        address: body.address || null,
        comments: body.comments || null,
        openingBalance: body.openingBalance ?? 0,
        balance: body.balance ?? body.openingBalance ?? 0,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}