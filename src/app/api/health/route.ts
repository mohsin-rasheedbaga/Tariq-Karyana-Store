import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextResponse } from 'next/server';

export async function GET() {
  const info: Record<string, string | number | boolean> = { status: 'checking' };
  
  // 1. DB init
  try {
    await ensureDbReady();
    info.dbInit = 'ok';
  } catch (e: any) {
    info.dbInit = 'FAILED: ' + (e.message || '').slice(0, 100);
    return NextResponse.json(info, { status: 500 });
  }

  // 2. Test each table
  const tables = [
    ['User', () => db.user.count()],
    ['Product', () => db.product.count()],
    ['Customer', () => db.customer.count()],
    ['Sale', () => db.sale.count()],
    ['Purchase', () => db.purchase.count()],
    ['Expense', () => db.expense.count()],
    ['ProductGroup', () => db.productGroup.count()],
  ] as [string, () => Promise<any>][];

  for (const [name, fn] of tables) {
    try {
      const count = await fn();
      info[`table_${name}`] = count;
    } catch (e: any) {
      info[`table_${name}`] = 'ERROR: ' + (e.message || '').slice(0, 80);
    }
  }

  info.status = 'ok';
  return NextResponse.json(info);
}