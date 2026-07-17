import { db } from '@/lib/db';
import { generateInvoiceNo } from '@/lib/barcode';
import { ensureDbReady } from '@/lib/db-init';
import { safeTransaction } from '@/lib/safe-transaction';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const sales = await db.sale.findMany({
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
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const body = await request.json();
    const { customerId, saleManName, saleType, items, discountAmount, paid, remarks } = body;

    // Calculate subtotal (outside transaction — pure computation)
    const subtotal = items.reduce((sum: number, item: { quantity: number; price: number }) => {
      return sum + item.quantity * item.price;
    }, 0);
    const total = subtotal - (discountAmount || 0);

    // v1.3.3 CRITICAL FIX: Read settings + generate invoiceNo INSIDE the transaction.
    // Previous code read settings outside → concurrent sales got the same saleInvoiceNo
    // → generated duplicate invoiceNo → unique constraint 500 error.
    // Now each transaction reads the CURRENT saleInvoiceNo after acquiring the write lock.
    const sale = await safeTransaction(async (tx) => {
      // Read settings inside the transaction (gets the latest value).
      let settings = await tx.settings.findFirst();
      if (!settings) {
        settings = await tx.settings.create({ data: {} });
      }

      const invoiceNo = generateInvoiceNo(settings.invoicePrefix, settings.saleInvoiceNo);

      // Increment the invoice number.
      await tx.settings.update({
        where: { id: settings.id },
        data: { saleInvoiceNo: settings.saleInvoiceNo + 1 },
      });

      // Create the sale.
      const newSale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: customerId || null,
          saleManName: saleManName || null,
          saleType: saleType || 'cash',
          subtotal,
          discountAmount: discountAmount || 0,
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
          customer: true,
        },
      });

      // Deduct stock from each product
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Update customer balance if credit sale
      if (customerId) {
        const due = total - (paid || 0);
        if (due > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { balance: { increment: due } },
          });
        }
      }

      return newSale;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}
