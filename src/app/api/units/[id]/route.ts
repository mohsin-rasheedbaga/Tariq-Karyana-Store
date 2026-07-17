import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const { id } = await params;
    const body = await request.json();

    const unit = await db.unit.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        shortName: body.shortName ?? undefined,
        isActive: body.isActive ?? undefined,
      },
    });

    return NextResponse.json(unit);
  } catch (error) {
    console.error('Error updating unit:', error);
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const { id } = await params;

    // Check if any products use this unit
    const productCount = await db.product.count({
      where: { unitId: id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: used by products' },
        { status: 400 }
      );
    }

    const unit = await db.unit.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(unit);
  } catch (error) {
    console.error('Error deleting unit:', error);
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
  }
}