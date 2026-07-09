import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: {
        isActive: true,
        stock: { gt: 0 },
      },
      include: {
        subCategory: true,
        group: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching stock report:', error);
    return NextResponse.json({ error: 'Failed to fetch stock report' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, newStock, reason } = body;

    // Get current product stock
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const oldStock = product.stock;
    const difference = newStock - oldStock;

    // Create adjustment and update stock in a transaction
    const adjustment = await db.$transaction(async (tx) => {
      const stockAdjustment = await tx.stockAdjustment.create({
        data: {
          productId,
          oldStock,
          newStock,
          difference,
          reason: reason || null,
        },
        include: {
          product: {
            include: {
              subCategory: true,
              group: true,
              unit: true,
            },
          },
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      return stockAdjustment;
    });

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    return NextResponse.json({ error: 'Failed to create stock adjustment' }, { status: 500 });
  }
}