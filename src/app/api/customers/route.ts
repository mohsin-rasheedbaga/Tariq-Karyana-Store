import { db } from '@/lib/db';
import { generateCustomerBarcode } from '@/lib/barcode';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

/**
 * v1.3.3 FIX: Generate a unique account number with collision retry.
 * Previous version used a single Math.random() which can collide (birthday
 * paradox) → unique constraint violation → 500 error on customer save.
 */
async function generateUniqueAccountNo(): Promise<string> {
  const yr = new Date().getFullYear().toString().slice(-2);
  for (let attempt = 0; attempt < 10; attempt++) {
    const seq = Math.floor(Math.random() * 900000) + 100000;
    const candidate = `ACC-${yr}${seq}`;
    try {
      const existing = await db.customer.findFirst({ where: { accountNo: candidate } });
      if (!existing) return candidate;
    } catch {
      // If the check itself fails (e.g., table not ready), return the candidate
      // and let the create attempt surface any real error.
      return candidate;
    }
  }
  // Extremely unlikely fallback — append timestamp for uniqueness.
  return `ACC-${yr}${Date.now().toString().slice(-6)}`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
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
                { accountNo: { contains: search } },
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
    // v1.3.3 FIX: Ensure DB is ready before writing (safety net if auto-login init failed).
    await ensureDbReady();

    const body = await request.json();
    const barcode = body.barcode || generateCustomerBarcode();
    const cardType = body.cardType || 'regular';
    const accountNo = body.accountNo || (await generateUniqueAccountNo());

    const customer = await db.customer.create({
      data: {
        barcode,
        name: body.name,
        phone: body.phone || null,
        address: body.address || null,
        comments: body.comments || null,
        cardType,
        accountNo,
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
