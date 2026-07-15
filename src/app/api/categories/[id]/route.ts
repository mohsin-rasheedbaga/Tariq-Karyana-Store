import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const body = await request.json();

    const category = await db.productCategory.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        isActive: body.isActive ?? undefined,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabase();
    const { id } = await params;

    // Check if any sub-categories use this category
    const subCategoryCount = await db.productSubCategory.count({
      where: { categoryId: id },
    });

    if (subCategoryCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: used by sub-categories' },
        { status: 400 }
      );
    }

    const category = await db.productCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}