import { db } from '@/lib/db';
import { generateInvoiceNo } from '@/lib/barcode';
import { ensureDbReady } from '@/lib/db-init';
import { safeTransaction } from '@/lib/safe-transaction';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    await ensureDbReady();
    const purchases = await db.purchase.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        party: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net).
    await ensureDbReady();

    const body = await request.json();
    const { partyId, purchaseType, items, paid, remarks } = body;

    // Calculate subtotal and total (outside transaction — pure computation)
    const subtotal = items.reduce((sum: number, item: { quantity: number; price: number }) => {
      return sum + item.quantity * item.price;
    }, 0);
    const total = subtotal;

    // v1.3.3 CRITICAL FIX: Read settings + generate invoiceNo INSIDE the transaction
    // to prevent duplicate invoiceNo under concurrent requests.
    const purchase = await safeTransaction(async (tx) => {
      let settings = await tx.settings.findFirst();
      if (!settings) {
        settings = await tx.settings.create({ data: {} });
      }

      const invoiceNo = generateInvoiceNo('PUR', settings.purchaseInvoiceNo);

      await tx.settings.update({
        where: { id: settings.id },
        data: { purchaseInvoiceNo: settings.purchaseInvoiceNo + 1 },
      });

      const newPurchase = await tx.purchase.create({
        data: {
          invoiceNo,
          partyId: partyId || null,
          purchaseType: purchaseType || 'cash',
          subtotal,
          total,
          paid: paid || 0,
          remarks: remarks || null,
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
          items: {
            include: {
              product: true,
            },
          },
          party: true,
        },
      });

      // Add stock to each product
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Update party balance if credit purchase
      if (partyId) {
        const due = total - (paid || 0);
        if (due > 0) {
          await tx.party.update({
            where: { id: partyId },
            data: { balance: { increment: due } },
          });
        }
      }

      return newPurchase;
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase:', error);
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 });
  }
}
