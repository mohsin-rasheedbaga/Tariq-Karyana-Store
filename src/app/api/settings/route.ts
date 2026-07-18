import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    await ensureDbReady();
    let settings = await db.settings.findFirst();

    if (!settings) {
      // Create default settings if none exist
      settings = await db.settings.create({
        data: {},
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // v1.3.3 FIX: Ensure DB + Settings are ready (safety net if auto-login init failed).
    await ensureDbReady();

    const body = await request.json();

    // Ensure settings exist
    let settings = await db.settings.findFirst();
    if (!settings) {
      settings = await db.settings.create({ data: {} });
    }

    const updated = await db.settings.update({
      where: { id: settings.id },
      data: {
        storeName: body.storeName ?? undefined,
        storeAddress: body.storeAddress ?? undefined,
        storePhone: body.storePhone ?? undefined,
        invoicePrefix: body.invoicePrefix ?? undefined,
        autoPrint: body.autoPrint ?? undefined,
        defaultPrinter: body.defaultPrinter ?? undefined,
        supabaseUrl: body.supabaseUrl ?? undefined,
        supabaseKey: body.supabaseKey ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}