import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: {
        subCategory: true,
        group: true,
        unit: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const product = await db.product.update({
      where: { id },
      data: {
        name: body.name,
        subCategoryId: body.subCategoryId || null,
        groupId: body.groupId || null,
        unitId: body.unitId || null,
        purchasePrice: body.purchasePrice ?? undefined,
        salePrice: body.salePrice ?? undefined,
        wholeSalePrice: body.wholeSalePrice ?? undefined,
        stock: body.stock ?? undefined,
        minStock: body.minStock ?? undefined,
        hasImage: body.hasImage ?? undefined,
        imageUrl: body.imageUrl ?? undefined,
      },
      include: {
        subCategory: true,
        group: true,
        unit: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await db.product.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}