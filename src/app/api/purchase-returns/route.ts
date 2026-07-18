import { db } from '@/lib/db';
import { generateInvoiceNo } from '@/lib/barcode';
import { ensureDbReady } from '@/lib/db-init';
import { safeTransaction } from '@/lib/safe-transaction';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const returns = await db.purchaseReturn.findMany({
      where,
      include: {
        party: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(returns);
  } catch (error) {
    console.error('Error fetching purchase returns:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase returns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const body = await request.json();
    const { partyId, originalInvoiceNo, items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided for return' }, { status: 400 });
    }

    // Validate each return quantity is > 0
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: `Invalid return quantity for ${item.productName}` }, { status: 400 });
      }
    }

    // Get settings and generate return number. ensureDbReady() should guarantee a
    // row exists, but we keep a defensive fallback just in case.
    // v1.3.3: settings read moved INSIDE transaction below to prevent duplicate returnNo.

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; price: number }) => sum + item.quantity * item.price,
      0
    );
    const total = subtotal;

    // Create purchase return in a transaction
    const purchaseReturn = await safeTransaction(async (tx) => {
      // v1.3.3 FIX: Read settings INSIDE the transaction to prevent duplicate returnNo.
      let settings = await tx.settings.findFirst();
      if (!settings) {
        settings = await tx.settings.create({ data: {} });
      }
      const returnNo = generateInvoiceNo('PRET', settings.purchaseReturnNo);

      // Update settings return number
      await tx.settings.update({
        where: { id: settings.id },
        data: { purchaseReturnNo: settings.purchaseReturnNo + 1 },
      });

      // Create the purchase return
      const newReturn = await tx.purchaseReturn.create({
        data: {
          returnNo,
          partyId: partyId || null,
          originalInvoiceNo: originalInvoiceNo || null,
          subtotal,
          total,
          items: {
            create: items.map((item: { productId: string; productName: string; quantity: number; price: number }) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              price: item.price,
              total: item.quantity * item.price,
            })),
          },
        },
        include: {
          party: true,
          items: true,
        },
      });

      // Deduct stock for each returned product
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // If there's a party and the original purchase was credit, reduce party balance
      if (partyId) {
        const returnTotal = total;
        await tx.party.update({
          where: { id: partyId },
          data: { balance: { decrement: returnTotal } },
        });
      }

      return newReturn;
    });

    return NextResponse.json(purchaseReturn, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase return:', error);
    return NextResponse.json({ error: 'Failed to create purchase return' }, { status: 500 });
  }
}