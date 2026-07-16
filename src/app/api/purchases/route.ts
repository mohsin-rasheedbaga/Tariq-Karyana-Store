import { db } from '@/lib/db';
import { generateInvoiceNo } from '@/lib/barcode';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
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
    const body = await request.json();
    const { partyId, purchaseType, items, paid, remarks } = body;

    // Get settings and increment purchase invoice number
    const settings = await db.settings.findFirst();
    if (!settings) {
      return NextResponse.json({ error: 'Settings not found. Please initialize settings first.' }, { status: 400 });
    }

    const invoiceNo = generateInvoiceNo('PUR', settings.purchaseInvoiceNo);

    // Calculate subtotal and total
    const subtotal = items.reduce((sum: number, item: { quantity: number; price: number }) => {
      return sum + item.quantity * item.price;
    }, 0);

    const total = subtotal;

    // Create purchase with items in a transaction
    const purchase = await db.$transaction(async (tx) => {
      // Update settings invoice number
      await tx.settings.update({
        where: { id: settings.id },
        data: { purchaseInvoiceNo: settings.purchaseInvoiceNo + 1 },
      });

      // Create the purchase
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