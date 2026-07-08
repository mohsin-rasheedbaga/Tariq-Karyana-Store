import { db } from '@/lib/db';
import { generateProductBarcode } from '@/lib/barcode';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const products = await db.product.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { barcode: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        subCategory: true,
        group: true,
        unit: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const barcode = body.barcode || generateProductBarcode();

    const product = await db.product.create({
      data: {
        barcode,
        name: body.name,
        subCategoryId: body.subCategoryId || null,
        groupId: body.groupId || null,
        unitId: body.unitId || null,
        purchasePrice: body.purchasePrice ?? 0,
        salePrice: body.salePrice ?? 0,
        wholeSalePrice: body.wholeSalePrice ?? 0,
        stock: body.stock ?? 0,
        minStock: body.minStock ?? 0,
      },
      include: {
        subCategory: true,
        group: true,
        unit: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}