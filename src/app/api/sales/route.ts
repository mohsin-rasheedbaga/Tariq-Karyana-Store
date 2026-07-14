import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { generateInvoiceNo } from '@/lib/barcode';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
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
    await ensureDatabase();
    const body = await request.json();
    const { customerId, saleManName, saleType, items, discountAmount, paid, remarks } = body;

    // Get settings and increment sale invoice number
    const settings = await db.settings.findFirst();
    if (!settings) {
      return NextResponse.json({ error: 'Settings not found. Please initialize settings first.' }, { status: 400 });
    }

    const invoiceNo = generateInvoiceNo(settings.invoicePrefix, settings.saleInvoiceNo);

    // Calculate subtotal
    const subtotal = items.reduce((sum: number, item: { quantity: number; price: number }) => {
      return sum + item.quantity * item.price;
    }, 0);

    const total = subtotal - (discountAmount || 0);

    // Create sale with items in a transaction
    const sale = await db.$transaction(async (tx) => {
      // Update settings invoice number
      await tx.settings.update({
        where: { id: settings.id },
        data: { saleInvoiceNo: settings.saleInvoiceNo + 1 },
      });

      // Create the sale
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