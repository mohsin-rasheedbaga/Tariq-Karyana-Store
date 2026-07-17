import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const party = await db.party.findUnique({
      where: { id },
    });

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    return NextResponse.json(party);
  } catch (error) {
    console.error('Error fetching party:', error);
    return NextResponse.json({ error: 'Failed to fetch party' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const { id } = await params;
    const body = await request.json();

    const party = await db.party.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        phone: body.phone ?? undefined,
        address: body.address ?? undefined,
      },
    });

    return NextResponse.json(party);
  } catch (error) {
    console.error('Error updating party:', error);
    return NextResponse.json({ error: 'Failed to update party' }, { status: 500 });
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

    // Check if vendor has active purchases
    const activePurchases = await db.purchase.count({
      where: { partyId: id },
    });

    if (activePurchases > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: vendor has active purchases' },
        { status: 400 }
      );
    }

    const party = await db.party.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(party);
  } catch (error) {
    console.error('Error deleting party:', error);
    return NextResponse.json({ error: 'Failed to delete party' }, { status: 500 });
  }
}