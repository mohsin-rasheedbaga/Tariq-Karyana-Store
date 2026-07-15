import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { generateInvoiceNo } from '@/lib/barcode';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const invoiceNo = searchParams.get('invoiceNo');

    // Lookup a sale by invoice number (for the new return dialog)
    if (invoiceNo) {
      const sale = await db.sale.findUnique({
        where: { invoiceNo },
        include: {
          items: true,
          customer: true,
        },
      });

      if (!sale) {
        return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
      }

      return NextResponse.json(sale);
    }

    // List sale returns with optional date filter
    const returns = await db.saleReturn.findMany({
      where: {
        ...(startDate && endDate
          ? {
              createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            }
          : {}),
      },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(returns);
  } catch (error) {
    console.error('Error fetching sale returns:', error);
    return NextResponse.json({ error: 'Failed to fetch sale returns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const { originalInvoiceNo, items } = body;

    if (!originalInvoiceNo || !items || items.length === 0) {
      return NextResponse.json({ error: 'Original invoice number and items are required' }, { status: 400 });
    }

    // Validate original sale exists
    const originalSale = await db.sale.findUnique({
      where: { invoiceNo: originalInvoiceNo },
      include: { customer: true },
    });

    if (!originalSale) {
      return NextResponse.json({ error: 'Original sale not found' }, { status: 404 });
    }

    // Get settings and generate return number
    const settings = await db.settings.findFirst();
    if (!settings) {
      return NextResponse.json({ error: 'Settings not found. Please initialize settings first.' }, { status: 400 });
    }

    const returnNo = generateInvoiceNo('RET', settings.saleReturnNo);

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; price: number }) => sum + item.quantity * item.price,
      0
    );
    const total = subtotal;

    // Create return in a transaction
    const saleReturn = await db.$transaction(async (tx) => {
      // Update settings return invoice number
      await tx.settings.update({
        where: { id: settings.id },
        data: { saleReturnNo: settings.saleReturnNo + 1 },
      });

      // Create the sale return with items
      const newReturn = await tx.saleReturn.create({
        data: {
          returnNo,
          customerId: originalSale.customerId || null,
          originalInvoiceNo,
          subtotal,
          total,
          items: {
            create: items.map(
              (item: { productId: string; productName: string; quantity: number; price: number }) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
                total: item.quantity * item.price,
              })
            ),
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });

      // Add returned quantity back to product stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // If credit sale, reduce customer balance by the return total
      if (originalSale.customerId && originalSale.saleType === 'credit') {
        await tx.customer.update({
          where: { id: originalSale.customerId },
          data: { balance: { decrement: total } },
        });
      }

      return newReturn;
    });

    return NextResponse.json(saleReturn, { status: 201 });
  } catch (error) {
    console.error('Error creating sale return:', error);
    return NextResponse.json({ error: 'Failed to create sale return' }, { status: 500 });
  }
}