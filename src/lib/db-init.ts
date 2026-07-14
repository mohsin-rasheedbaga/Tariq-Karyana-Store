import { db } from './db';
import { SCHEMA_SQL, MIGRATION_SQL } from './schema-sql';

let initialized = false;

/**
 * Ensure database schema exists and is up-to-date.
 * Safe to call multiple times (idempotent).
 * This is the SINGLE source of truth for DB initialization
 * used by ALL API routes.
 */
export async function ensureDatabase(): Promise<void> {
  if (initialized) return;

  try {
    // ALWAYS run the full schema SQL — every statement uses IF NOT EXISTS
    // so this is safe and idempotent. This fixes the bug where only the
    // User table existed (from a partial init) but other tables were missing.
    console.log('[DB] Ensuring database schema...');
    const statements = SCHEMA_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const sql of statements) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.warn('[DB] Schema statement warning:', e.message?.slice(0, 100));
        }
      }
    }
    console.log('[DB] Schema verified/created successfully.');

    // Run migrations for new columns on existing databases
    await runMigrations();
    initialized = true;
    console.log('[DB] Database ready.');
  } catch (error: any) {
    console.error('[DB] Failed to initialize database:', error.message || error);
    // Reset flag so next call retries
    initialized = false;
    throw error;
  }
}

async function runMigrations() {
  try {
    const statements = MIGRATION_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const sql of statements) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
          console.warn('[DB] Migration warning:', e.message?.slice(0, 100));
        }
      }
    }
  } catch (e) {
    console.warn('[DB] Migration error:', e);
  }
}

/**
 * Ensure default admin user exists.
 */
export async function ensureAdminUser(): Promise<void> {
  try {
    const count = await db.user.count();
    if (count === 0) {
      await db.user.create({
        data: {
          username: 'admin',
          password: 'admin123',
          fullName: 'Admin',
          role: 'admin',
          isActive: true,
          permissions: JSON.stringify({
            dashboard: true, sales: true, products: true,
            purchases: true, customers: true, expenses: true,
            reports: true, users: true, settings: true, bank: true,
            stock: true, categories: true, units: true, groups: true, party: true,
          }),
        },
      });
      console.log('[DB] Default admin created (admin / admin123)');
    }
  } catch (error) {
    console.error('[DB] Failed to create admin:', error);
  }
}

/**
 * Seed kiryana products if none exist.
 */
export async function ensureProductsSeeded(forceReseed: boolean = false): Promise<number> {
  try {
    const productCount = await db.product.count();
    if (productCount > 0 && !forceReseed) {
      console.log(`[DB] ${productCount} products already exist, skipping seed.`);
      return productCount;
    }

    // If forceReseed and products exist, delete them first
    if (forceReseed && productCount > 0) {
      console.log(`[DB] Force reseeding: deleting ${productCount} existing products...`);
      await db.saleItem.deleteMany({});
      await db.sale.deleteMany({});
      await db.product.deleteMany({});
    }

    console.log('[DB] No products found, seeding kiryana store products...');
    const { generateProductBarcode } = await import('./barcode');

    const KARYANA_PRODUCTS = [
      { name: 'آٹا مٹی (10kg)', purchasePrice: 950, salePrice: 1100, wholeSalePrice: 1050, stock: 50, minStock: 10, group: 'آٹا' },
      { name: 'آٹا سفید (10kg)', purchasePrice: 1050, salePrice: 1200, wholeSalePrice: 1150, stock: 40, minStock: 10, group: 'آٹا' },
      { name: 'آٹا چھوٹا (5kg)', purchasePrice: 500, salePrice: 600, wholeSalePrice: 570, stock: 60, minStock: 15, group: 'آٹا' },
      { name: 'میدا (1kg)', purchasePrice: 80, salePrice: 100, wholeSalePrice: 90, stock: 100, minStock: 20, group: 'آٹا' },
      { name: 'بسن (500g)', purchasePrice: 50, salePrice: 70, wholeSalePrice: 60, stock: 80, minStock: 20, group: 'آٹا' },
      { name: 'سوگی (500g)', purchasePrice: 55, salePrice: 75, wholeSalePrice: 65, stock: 60, minStock: 15, group: 'آٹا' },
      { name: 'چینی (1kg)', purchasePrice: 130, salePrice: 155, wholeSalePrice: 145, stock: 100, minStock: 20, group: 'چینی' },
      { name: 'چینی (5kg)', purchasePrice: 620, salePrice: 740, wholeSalePrice: 700, stock: 30, minStock: 10, group: 'چینی' },
      { name: 'چائے پتی (200g)', purchasePrice: 250, salePrice: 320, wholeSalePrice: 300, stock: 80, minStock: 15, group: 'چائے' },
      { name: 'چائے پتی (400g)', purchasePrice: 480, salePrice: 620, wholeSalePrice: 580, stock: 50, minStock: 10, group: 'چائے' },
      { name: 'چائے ڈنڈی (950g)', purchasePrice: 900, salePrice: 1100, wholeSalePrice: 1050, stock: 30, minStock: 5, group: 'چائے' },
      { name: 'گھی (1kg)', purchasePrice: 500, salePrice: 620, wholeSalePrice: 580, stock: 50, minStock: 10, group: 'گھی' },
      { name: 'گھی (500g)', purchasePrice: 260, salePrice: 330, wholeSalePrice: 310, stock: 60, minStock: 15, group: 'گھی' },
      { name: 'کھل (500g)', purchasePrice: 230, salePrice: 290, wholeSalePrice: 270, stock: 40, minStock: 10, group: 'گھی' },
      { name: 'دال چنا (1kg)', purchasePrice: 180, salePrice: 220, wholeSalePrice: 200, stock: 80, minStock: 15, group: 'دالین' },
      { name: 'دال مونگ (1kg)', purchasePrice: 220, salePrice: 270, wholeSalePrice: 250, stock: 60, minStock: 15, group: 'دالین' },
      { name: 'دال مسور (1kg)', purchasePrice: 200, salePrice: 250, wholeSalePrice: 230, stock: 60, minStock: 15, group: 'دالین' },
      { name: 'دال ادکی (1kg)', purchasePrice: 250, salePrice: 310, wholeSalePrice: 290, stock: 50, minStock: 10, group: 'دالین' },
      { name: 'دال توار (1kg)', purchasePrice: 300, salePrice: 380, wholeSalePrice: 350, stock: 40, minStock: 10, group: 'دالین' },
      { name: 'لوبیا سفید (1kg)', purchasePrice: 230, salePrice: 290, wholeSalePrice: 270, stock: 40, minStock: 10, group: 'دالین' },
      { name: 'رائی (1kg)', purchasePrice: 200, salePrice: 260, wholeSalePrice: 240, stock: 40, minStock: 10, group: 'دالین' },
      { name: 'چاول بسمتی (5kg)', purchasePrice: 600, salePrice: 750, wholeSalePrice: 700, stock: 30, minStock: 10, group: 'چاول' },
      { name: 'چاول سیدھا (5kg)', purchasePrice: 350, salePrice: 450, wholeSalePrice: 420, stock: 40, minStock: 10, group: 'چاول' },
      { name: 'چاول جھولا (25kg)', purchasePrice: 2200, salePrice: 2600, wholeSalePrice: 2500, stock: 10, minStock: 3, group: 'چاول' },
      { name: 'نمک فائن (800g)', purchasePrice: 25, salePrice: 40, wholeSalePrice: 35, stock: 200, minStock: 50, group: 'نمک' },
      { name: 'نمک کھرا (1kg)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 30, stock: 150, minStock: 30, group: 'نمک' },
      { name: 'ہلدی پاؤڈر (100g)', purchasePrice: 60, salePrice: 90, wholeSalePrice: 80, stock: 100, minStock: 20, group: 'مصالحے' },
      { name: 'لال مرچ (100g)', purchasePrice: 70, salePrice: 100, wholeSalePrice: 90, stock: 100, minStock: 20, group: 'مصالحے' },
      { name: 'دھنیا پاؤڈر (100g)', purchasePrice: 50, salePrice: 80, wholeSalePrice: 70, stock: 100, minStock: 20, group: 'مصالحے' },
      { name: 'گرم مسالا (100g)', purchasePrice: 100, salePrice: 150, wholeSalePrice: 130, stock: 80, minStock: 15, group: 'مصالحے' },
      { name: 'کالا نمک (200g)', purchasePrice: 30, salePrice: 50, wholeSalePrice: 40, stock: 80, minStock: 20, group: 'مصالحے' },
      { name: 'سفید جیرا (100g)', purchasePrice: 80, salePrice: 120, wholeSalePrice: 100, stock: 60, minStock: 15, group: 'مصالحے' },
      { name: 'صابن لائیف بوائے (1pcs)', purchasePrice: 80, salePrice: 110, wholeSalePrice: 100, stock: 100, minStock: 20, group: 'صابن' },
      { name: 'صابن واشنگ (1pcs)', purchasePrice: 60, salePrice: 90, wholeSalePrice: 80, stock: 100, minStock: 20, group: 'صابن' },
      { name: 'صابن ڈش (1pcs)', purchasePrice: 40, salePrice: 60, wholeSalePrice: 55, stock: 80, minStock: 20, group: 'صابن' },
      { name: 'تل بنولے (1L)', purchasePrice: 350, salePrice: 430, wholeSalePrice: 410, stock: 40, minStock: 10, group: 'تیل' },
      { name: 'تل بنولے (5L)', purchasePrice: 1700, salePrice: 2050, wholeSalePrice: 1950, stock: 15, minStock: 5, group: 'تیل' },
      { name: 'تل سرسوں (1L)', purchasePrice: 400, salePrice: 500, wholeSalePrice: 470, stock: 30, minStock: 8, group: 'تیل' },
      { name: 'پانی بوتل (1.5L)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 30, stock: 200, minStock: 50, group: 'مشروبات' },
      { name: 'کوکا کولا (1.5L)', purchasePrice: 100, salePrice: 140, wholeSalePrice: 125, stock: 50, minStock: 10, group: 'مشروبات' },
      { name: 'پیپسی (1.5L)', purchasePrice: 95, salePrice: 135, wholeSalePrice: 120, stock: 50, minStock: 10, group: 'مشروبات' },
      { name: 'بسکٹ ماری (big)', purchasePrice: 30, salePrice: 50, wholeSalePrice: 45, stock: 100, minStock: 20, group: 'بسکٹ' },
      { name: 'بسکٹ اوریو (small)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 30, stock: 120, minStock: 25, group: 'بسکٹ' },
      { name: 'بسکٹ گلوکو (big)', purchasePrice: 25, salePrice: 45, wholeSalePrice: 40, stock: 100, minStock: 20, group: 'بسکٹ' },
      { name: 'دودھ پیک (1L)', purchasePrice: 140, salePrice: 180, wholeSalePrice: 165, stock: 30, minStock: 10, group: 'دودھ' },
      { name: 'دہی پیک (1kg)', purchasePrice: 150, salePrice: 200, wholeSalePrice: 180, stock: 20, minStock: 5, group: 'دودھ' },
      { name: 'اینٹی سینٹ (200ml)', purchasePrice: 100, salePrice: 150, wholeSalePrice: 130, stock: 40, minStock: 10, group: 'سنگھار' },
      { name: 'شیمپو (180ml)', purchasePrice: 120, salePrice: 180, wholeSalePrice: 160, stock: 40, minStock: 10, group: 'سنگھار' },
    ];

    // Create groups first
    const groups = [...new Set(KARYANA_PRODUCTS.map(p => p.group))];
    const groupRecords: Record<string, string> = {};
    for (const gName of groups) {
      const existing = await db.productGroup.findFirst({ where: { name: gName } });
      if (existing) {
        groupRecords[gName] = existing.id;
      } else {
        const created = await db.productGroup.create({ data: { name: gName } });
        groupRecords[gName] = created.id;
      }
    }

    let added = 0;
    for (const p of KARYANA_PRODUCTS) {
      await db.product.create({
        data: {
          barcode: generateProductBarcode(),
          name: p.name,
          purchasePrice: p.purchasePrice,
          salePrice: p.salePrice,
          wholeSalePrice: p.wholeSalePrice,
          stock: p.stock,
          minStock: p.minStock,
          groupId: groupRecords[p.group] || null,
        },
      });
      added++;
    }
    console.log(`[DB] Seeded ${added} kiryana products successfully.`);
    return added;
  } catch (e) {
    console.error('[DB] Seed failed:', e);
    return 0;
  }
}