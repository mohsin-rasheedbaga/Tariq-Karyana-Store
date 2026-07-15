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

    const group = await db.productGroup.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        isActive: body.isActive ?? undefined,
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error('Error updating group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabase();
    const { id } = await params;

    // Check if any products use this group
    const productCount = await db.product.count({
      where: { groupId: id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: used by products' },
        { status: 400 }
      );
    }

    const group = await db.productGroup.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}