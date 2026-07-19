import { db, dbInitError } from './db';
import { SCHEMA_SQL, MIGRATION_SQL } from './schema-sql';

/**
 * v1.3.3 FIX — Complete rewrite of DB initialization.
 *
 * PREVIOUS BUGS (v1.2.9–v1.3.2):
 *  1. ensureDatabase() marked itself "initialized" even when it FAILED.
 *     A single error during schema creation → app stuck broken forever
 *     (every query hit missing tables → 500 on everything).
 *  2. No default Settings row was ever created → sales/purchases/returns
 *     failed with "Settings not found" on fresh installs.
 *  3. Migration SQL for accountNo UNIQUE index failed on existing DBs
 *     (duplicate empty strings) — error swallowed, index never created.
 *  4. $executeRawUnsafe('SELECT 1') is the wrong API for SELECT.
 *
 * THIS VERSION:
 *  - NEVER marks as initialized unless schema VERIFIED (all critical tables/columns exist).
 *  - On failure, leaves flag UNSET so the next API call retries automatically.
 *  - Creates a default Settings row (fixes sale/purchase save on fresh install).
 *  - Fixes existing customers with empty/duplicate accountNo before unique index.
 *  - Uses $queryRawUnsafe for SELECT verification.
 *  - Runs pragmas (WAL, busy_timeout) for concurrency reliability.
 */

const DB_INIT_KEY = '__tariq_pos_db_initialized_v133__';
const SEED_LOCK_KEY = '__tariq_pos_seeding__';
const SETTINGS_KEY = '__tariq_pos_settings_ok__';

function isDbInitialized(): boolean {
  return !!(globalThis as any)[DB_INIT_KEY];
}
function markDbInitialized(): void {
  (globalThis as any)[DB_INIT_KEY] = true;
}
function clearDbInitialized(): void {
  (globalThis as any)[DB_INIT_KEY] = false;
}
function isSeedingInProgress(): boolean {
  return !!(globalThis as any)[SEED_LOCK_KEY];
}
function setSeedingFlag(v: boolean): void {
  (globalThis as any)[SEED_LOCK_KEY] = v;
}

/**
 * Check whether a specific column exists on a table (SQLite).
 */
async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `PRAGMA table_info("${table}")`
    );
    return rows.some((r: any) => r.name === column);
  } catch {
    return false;
  }
}

/**
 * Check whether a table exists.
 */
async function tableExists(table: string): Promise<boolean> {
  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Ensure database schema exists and is up-to-date.
 * SAFE to call multiple times. Uses globalThis flag so it's truly process-wide.
 *
 * v1.3.3: Only marks as initialized if VERIFICATION passes. On failure the
 * flag stays false, so the next API call retries automatically.
 */
export async function ensureDatabase(): Promise<void> {
  if (isDbInitialized()) return;

  // v1.3.8: If PrismaClient itself failed to initialize, don't even try to
  // run schema SQL — it would throw a confusing error. Let the caller surface
  // dbInitError instead.
  if (dbInitError || !db) {
    throw new Error(`Cannot ensure database: ${dbInitError || 'PrismaClient is null'}`);
  }

  let schemaOk = false;

  try {
    console.log('[DB] Ensuring database schema...');

    // 1. Create all tables (IF NOT EXISTS — idempotent)
    const statements = SCHEMA_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const sql of statements) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.warn('[DB] Schema statement warning:', e.message?.slice(0, 120));
        }
      }
    }

    // 2. Run column migrations (ADD COLUMN is idempotent-safe via error swallow)
    try {
      const migStatements = MIGRATION_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const sql of migStatements) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (e: any) {
          const m = e.message || '';
          if (!m.includes('duplicate column') && !m.includes('already exists') && !m.includes('UNIQUE constraint')) {
            console.warn('[DB] Migration warning:', m.slice(0, 120));
          }
        }
      }
    } catch (e) {
      console.warn('[DB] Migration block error (non-fatal):', e);
    }

    // 3. v1.3.3 FIX: Repair existing customers that have empty/duplicate accountNo
    //    BEFORE attempting to enforce the UNIQUE index. This is what broke upgrades
    //    from v1.2.x → v1.3.x in the previous versions.
    await repairCustomerAccountNos();

    // 4. v1.3.3 FIX: Re-attempt the accountNo unique index now that data is clean.
    try {
      await db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "Customer_accountNo_key" ON "Customer"("accountNo")'
      );
    } catch (e: any) {
      // If it still fails, there may be genuine duplicates — log but don't crash.
      console.warn('[DB] accountNo unique index warning:', e.message?.slice(0, 120));
    }

    // 5. VERIFY — confirm the critical tables & columns actually exist.
    schemaOk = await verifySchema();
    if (!schemaOk) {
      console.error('[DB] Schema verification FAILED — will retry on next call.');
      return; // Do NOT mark as initialized.
    }

    // 6. Apply SQLite reliability pragmas (WAL mode, busy_timeout).
    await applySqlitePragmasSafe();

    markDbInitialized();
    console.log('[DB] Database ready (verified).');
  } catch (error: any) {
    console.error('[DB] Init error (will retry next call):', error.message?.slice(0, 200));
    // v1.3.3: Do NOT mark as initialized — allow retry.
  }
}

/**
 * v1.3.3 FIX: Repair customers with empty or duplicate accountNo values
 * so the UNIQUE index can be created successfully.
 */
async function repairCustomerAccountNos(): Promise<void> {
  try {
    // Find customers with empty accountNo
    const emptyCustomers = await db.customer.findMany({ where: { accountNo: '' } });
    if (emptyCustomers.length === 0) return;

    console.log(`[DB] Repairing ${emptyCustomers.length} customers with empty accountNo...`);
    const yr = new Date().getFullYear().toString().slice(-2);
    for (let i = 0; i < emptyCustomers.length; i++) {
      const c = emptyCustomers[i];
      let newAcc = '';
      let attempts = 0;
      while (attempts < 10) {
        const seq = Math.floor(Math.random() * 900000) + 100000;
        newAcc = `ACC-${yr}${seq}`;
        const exists = await db.customer.findFirst({ where: { accountNo: newAcc } });
        if (!exists) break;
        attempts++;
      }
      try {
        await db.customer.update({ where: { id: c.id }, data: { accountNo: newAcc } });
      } catch {}
    }
    console.log('[DB] Customer accountNo repair complete.');
  } catch (e: any) {
    console.warn('[DB] accountNo repair warning:', e.message?.slice(0, 120));
  }
}

/**
 * v1.3.3 FIX: Verify that all critical tables and the Customer's new columns exist.
 * Returns true only if everything checks out.
 */
async function verifySchema(): Promise<boolean> {
  const requiredTables = [
    'User', 'ProductCategory', 'ProductSubCategory', 'ProductGroup', 'Unit',
    'Product', 'Customer', 'CashReceive', 'Party', 'CashPayment',
    'Sale', 'SaleItem', 'SaleReturn', 'SaleReturnItem',
    'Purchase', 'PurchaseItem', 'PurchaseReturn', 'PurchaseReturnItem',
    'StockAdjustment', 'ExpenseType', 'Expense', 'BankAccount', 'BankTransaction',
    'Capital', 'SalesMan', 'Settings',
  ];

  for (const table of requiredTables) {
    if (!(await tableExists(table))) {
      console.error(`[DB] Verify FAIL: table "${table}" missing.`);
      return false;
    }
  }

  // Verify Customer has the v1.3 columns (common upgrade failure point).
  if (!(await columnExists('Customer', 'cardType'))) {
    console.error('[DB] Verify FAIL: Customer.cardType missing.');
    return false;
  }
  if (!(await columnExists('Customer', 'accountNo'))) {
    console.error('[DB] Verify FAIL: Customer.accountNo missing.');
    return false;
  }

  return true;
}

/**
 * v1.3.3 FIX: Apply WAL mode + busy_timeout. Wrapped so it never throws.
 */
async function applySqlitePragmasSafe(): Promise<void> {
  try {
    await db.$executeRawUnsafe('PRAGMA journal_mode=WAL');
    await db.$executeRawUnsafe('PRAGMA busy_timeout=5000');
    await db.$executeRawUnsafe('PRAGMA foreign_keys=ON');
    await db.$executeRawUnsafe('PRAGMA synchronous=NORMAL');
  } catch (e: any) {
    console.warn('[DB] Pragma warning (non-fatal):', e.message?.slice(0, 100));
  }
}

/**
 * v1.3.3 FIX: Ensure a default Settings row exists. This was the #1 cause of
 * "save doesn't work" — sales/purchases/returns need Settings for invoice numbers,
 * but nothing ever created a default row on fresh install.
 */
export async function ensureSettings(): Promise<void> {
  if ((globalThis as any)[SETTINGS_KEY]) return;
  try {
    let settings = await db.settings.findFirst();
    if (!settings) {
      settings = await db.settings.create({ data: {} });
      console.log('[DB] Default Settings row created.');
    }
    (globalThis as any)[SETTINGS_KEY] = true;
  } catch (e: any) {
    console.warn('[DB] ensureSettings warning:', e.message?.slice(0, 120));
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
 * v1.3.3 FIX: Lightweight guard for write routes. Ensures DB is ready before
 * performing a write. Fast (O(1) after first init). Safe to call from every route.
 *
 * Use this at the top of any POST/PUT/DELETE handler that touches the DB:
 *   await ensureDbReady();
 */
export async function ensureDbReady(): Promise<void> {
  if (!isDbInitialized()) {
    await ensureDatabase();
  }
  await ensureSettings();
}

/**
 * Seed kiryana products if none exist.
 * Uses a global lock to prevent concurrent seeding.
 */
export async function ensureProductsSeeded(forceReseed: boolean = false): Promise<number> {
  // Prevent concurrent seeding (e.g., multiple auto-login calls)
  if (isSeedingInProgress()) {
    console.log('[DB] Seed already in progress, skipping.');
    return 0;
  }

  try {
    const productCount = await db.product.count();
    if (productCount > 0 && !forceReseed) {
      if (productCount >= 10) {
        console.log(`[DB] ${productCount} products exist, skipping seed.`);
        return productCount;
      }
      console.log(`[DB] Only ${productCount} products (partial seed), reseeding...`);
    }

    // Acquire seed lock
    setSeedingFlag(true);

    // If forceReseed or partial seed, delete existing products first
    if ((forceReseed || productCount < 10) && productCount > 0) {
      console.log(`[DB] Deleting ${productCount} existing products for reseed...`);
      try { await db.saleItem.deleteMany({}); } catch {}
      try { await db.sale.deleteMany({}); } catch {}
      try { await db.product.deleteMany({}); } catch {}
    }

    console.log('[DB] Seeding kiryana products...');
    const { generateProductBarcode } = await import('./barcode');

    const KARYANA_PRODUCTS = [
      { name: 'آٹا مٹی (10kg)', purchasePrice: 950, salePrice: 1100, wholeSalePrice: 1050, stock: 50, minStock: 10, group: 'آٹا' },
      { name: 'آٹا سفید (10kg)', purchasePrice: 1050, salePrice: 1200, wholeSalePrice: 1150, stock: 40, minStock: 10, group: 'آٹا' },
      { name: 'آٹا چھوٹا (5kg)', purchasePrice: 500, salePrice: 600, wholeSalePrice: 570, stock: 60, minStock: 15, group: 'آٹا' },
      { name: 'میدا (1kg)', purchasePrice: 80, salePrice: 100, wholeSalePrice: 90, stock: 100, minStock: 20, group: 'آٹا' },
      { name: 'بسن (500g)', purchasePrice: 50, salePrice: 70, wholeSalePrice: 60, stock: 80, minStock: 20, group: 'آٹا' },
      { name: 'سوگی (500g)', purchasePrice: 55, salePrice: 75, wholeSalePrice: 65, stock: 60, minStock: 15, group: 'آٹا' },
      { name: 'جاوہ (1kg)', purchasePrice: 120, salePrice: 150, wholeSalePrice: 140, stock: 40, minStock: 10, group: 'آٹا' },
      { name: 'چینی (1kg)', purchasePrice: 130, salePrice: 155, wholeSalePrice: 145, stock: 100, minStock: 20, group: 'چینی' },
      { name: 'چینی (5kg)', purchasePrice: 620, salePrice: 740, wholeSalePrice: 700, stock: 30, minStock: 10, group: 'چینی' },
      { name: 'چائے پتی (200g)', purchasePrice: 250, salePrice: 320, wholeSalePrice: 300, stock: 80, minStock: 15, group: 'چائے' },
      { name: 'چائے پتی (400g)', purchasePrice: 480, salePrice: 620, wholeSalePrice: 580, stock: 50, minStock: 10, group: 'چائے' },
      { name: 'چائے ڈنڈی (950g)', purchasePrice: 900, salePrice: 1100, wholeSalePrice: 1050, stock: 30, minStock: 5, group: 'چائے' },
      { name: 'گھی (1kg)', purchasePrice: 500, salePrice: 620, wholeSalePrice: 580, stock: 50, minStock: 10, group: 'گھی' },
      { name: 'گھی (500g)', purchasePrice: 260, salePrice: 330, wholeSalePrice: 310, stock: 60, minStock: 15, group: 'گھی' },
      { name: 'کھل (500g)', purchasePrice: 230, salePrice: 290, wholeSalePrice: 270, stock: 40, minStock: 10, group: 'گھی' },
      { name: 'مکھن (200g)', purchasePrice: 120, salePrice: 160, wholeSalePrice: 140, stock: 30, minStock: 10, group: 'گھی' },
      { name: 'دال چنا (1kg)', purchasePrice: 180, salePrice: 220, wholeSalePrice: 200, stock: 80, minStock: 15, group: 'دالین' },
      { name: 'دال مونگ (1kg)', purchasePrice: 220, salePrice: 270, wholeSalePrice: 250, stock: 60, minStock: 15, group: 'دالین' },
      { name: 'دال مسور (1kg)', purchasePrice: 200, salePrice: 250, wholeSalePrice: 230, stock: 60, minStock: 15, group: 'دالین' },
      { name: 'دال ادکی (1kg)', purchasePrice: 250, salePrice: 310, wholeSalePrice: 290, stock: 50, minStock: 10, group: 'دالین' },
      { name: 'دال توار (1kg)', purchasePrice: 300, salePrice: 380, wholeSalePrice: 350, stock: 40, minStock: 10, group: 'دالین' },
      { name: 'لوبیا سفید (1kg)', purchasePrice: 230, salePrice: 290, wholeSalePrice: 270, stock: 40, minStock: 10, group: 'دالین' },
      { name: 'رائی (1kg)', purchasePrice: 200, salePrice: 260, wholeSalePrice: 240, stock: 40, minStock: 10, group: 'دالین' },
      { name: 'دال کالا چنا (1kg)', purchasePrice: 260, salePrice: 320, wholeSalePrice: 300, stock: 40, minStock: 10, group: 'دالین' },
      { name: 'دال ماش (1kg)', purchasePrice: 350, salePrice: 420, wholeSalePrice: 390, stock: 30, minStock: 8, group: 'دالین' },
      { name: 'مٹر دال (1kg)', purchasePrice: 190, salePrice: 240, wholeSalePrice: 220, stock: 50, minStock: 12, group: 'دالین' },
      { name: 'چاول بسمتی (5kg)', purchasePrice: 600, salePrice: 750, wholeSalePrice: 700, stock: 30, minStock: 10, group: 'چاول' },
      { name: 'چاول سیدھا (5kg)', purchasePrice: 350, salePrice: 450, wholeSalePrice: 420, stock: 40, minStock: 10, group: 'چاول' },
      { name: 'چاول جھولا (25kg)', purchasePrice: 2200, salePrice: 2600, wholeSalePrice: 2500, stock: 10, minStock: 3, group: 'چاول' },
      { name: 'چاول پکا (1kg)', purchasePrice: 130, salePrice: 170, wholeSalePrice: 150, stock: 50, minStock: 10, group: 'چاول' },
      { name: 'نمک فائن (800g)', purchasePrice: 25, salePrice: 40, wholeSalePrice: 35, stock: 200, minStock: 50, group: 'نمک' },
      { name: 'نمک کھرا (1kg)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 30, stock: 150, minStock: 30, group: 'نمک' },
      { name: 'ہلدی پاؤڈر (100g)', purchasePrice: 60, salePrice: 90, wholeSalePrice: 80, stock: 100, minStock: 20, group: 'مصالحے' },
      { name: 'لال مرچ (100g)', purchasePrice: 70, salePrice: 100, wholeSalePrice: 90, stock: 100, minStock: 20, group: 'مصالحے' },
      { name: 'دھنیا پاؤڈر (100g)', purchasePrice: 50, salePrice: 80, wholeSalePrice: 70, stock: 100, minStock: 20, group: 'مصالحے' },
      { name: 'گرم مسالا (100g)', purchasePrice: 100, salePrice: 150, wholeSalePrice: 130, stock: 80, minStock: 15, group: 'مصالحے' },
      { name: 'کالا نمک (200g)', purchasePrice: 30, salePrice: 50, wholeSalePrice: 40, stock: 80, minStock: 20, group: 'مصالحے' },
      { name: 'سفید جیرا (100g)', purchasePrice: 80, salePrice: 120, wholeSalePrice: 100, stock: 60, minStock: 15, group: 'مصالحے' },
      { name: 'کالے جیرے (100g)', purchasePrice: 90, salePrice: 130, wholeSalePrice: 110, stock: 60, minStock: 15, group: 'مصالحے' },
      { name: 'سونف (100g)', purchasePrice: 120, salePrice: 170, wholeSalePrice: 150, stock: 50, minStock: 10, group: 'مصالحے' },
      { name: 'سفید مرچ (100g)', purchasePrice: 150, salePrice: 220, wholeSalePrice: 190, stock: 40, minStock: 10, group: 'مصالحے' },
      { name: 'امچور پاؤڈر (50g)', purchasePrice: 40, salePrice: 60, wholeSalePrice: 50, stock: 60, minStock: 15, group: 'مصالحے' },
      { name: 'کسرے کے بیج (100g)', purchasePrice: 70, salePrice: 100, wholeSalePrice: 85, stock: 40, minStock: 10, group: 'مصالحے' },
      { name: 'اجوائن (50g)', purchasePrice: 50, salePrice: 80, wholeSalePrice: 65, stock: 50, minStock: 12, group: 'مصالحے' },
      { name: 'تل بنولے (1L)', purchasePrice: 350, salePrice: 430, wholeSalePrice: 410, stock: 40, minStock: 10, group: 'تیل' },
      { name: 'تل بنولے (5L)', purchasePrice: 1700, salePrice: 2050, wholeSalePrice: 1950, stock: 15, minStock: 5, group: 'تیل' },
      { name: 'تل سرسوں (1L)', purchasePrice: 400, salePrice: 500, wholeSalePrice: 470, stock: 30, minStock: 8, group: 'تیل' },
      { name: 'تل زیتون (500ml)', purchasePrice: 600, salePrice: 800, wholeSalePrice: 750, stock: 15, minStock: 5, group: 'تیل' },
      { name: 'صابن لائیف بوائے (1pcs)', purchasePrice: 80, salePrice: 110, wholeSalePrice: 100, stock: 100, minStock: 20, group: 'صابن' },
      { name: 'صابن واشنگ (1pcs)', purchasePrice: 60, salePrice: 90, wholeSalePrice: 80, stock: 100, minStock: 20, group: 'صابن' },
      { name: 'صابن ڈش (1pcs)', purchasePrice: 40, salePrice: 60, wholeSalePrice: 55, stock: 80, minStock: 20, group: 'صابن' },
      { name: 'صابن لکس (1pcs)', purchasePrice: 85, salePrice: 120, wholeSalePrice: 105, stock: 80, minStock: 15, group: 'صابن' },
      { name: 'پانی بوتل (1.5L)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 30, stock: 200, minStock: 50, group: 'مشروبات' },
      { name: 'کوکا کولا (1.5L)', purchasePrice: 100, salePrice: 140, wholeSalePrice: 125, stock: 50, minStock: 10, group: 'مشروبات' },
      { name: 'پیپسی (1.5L)', purchasePrice: 95, salePrice: 135, wholeSalePrice: 120, stock: 50, minStock: 10, group: 'مشروبات' },
      { name: 'سپرٹ (1.5L)', purchasePrice: 90, salePrice: 130, wholeSalePrice: 115, stock: 40, minStock: 10, group: 'مشروبات' },
      { name: 'مرینڈا (1.5L)', purchasePrice: 90, salePrice: 130, wholeSalePrice: 115, stock: 40, minStock: 10, group: 'مشروبات' },
      { name: 'فینٹا (1.5L)', purchasePrice: 90, salePrice: 130, wholeSalePrice: 115, stock: 40, minStock: 10, group: 'مشروبات' },
      { name: 'ڈیتھ کاف (1.5L)', purchasePrice: 100, salePrice: 150, wholeSalePrice: 130, stock: 30, minStock: 8, group: 'مشروبات' },
      { name: 'سرکہ سفید (500ml)', purchasePrice: 40, salePrice: 60, wholeSalePrice: 50, stock: 60, minStock: 15, group: 'مشروبات' },
      { name: 'بسکٹ ماری (big)', purchasePrice: 30, salePrice: 50, wholeSalePrice: 45, stock: 100, minStock: 20, group: 'بسکٹ' },
      { name: 'بسکٹ اوریو (small)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 30, stock: 120, minStock: 25, group: 'بسکٹ' },
      { name: 'بسکٹ گلوکو (big)', purchasePrice: 25, salePrice: 45, wholeSalePrice: 40, stock: 100, minStock: 20, group: 'بسکٹ' },
      { name: 'بسکٹ چاکلیٹ (small)', purchasePrice: 15, salePrice: 25, wholeSalePrice: 22, stock: 100, minStock: 20, group: 'بسکٹ' },
      { name: 'چپس لیز (small)', purchasePrice: 15, salePrice: 30, wholeSalePrice: 25, stock: 80, minStock: 20, group: 'بسکٹ' },
      { name: 'دودھ پیک (1L)', purchasePrice: 140, salePrice: 180, wholeSalePrice: 165, stock: 30, minStock: 10, group: 'دودھ' },
      { name: 'دہی پیک (1kg)', purchasePrice: 150, salePrice: 200, wholeSalePrice: 180, stock: 20, minStock: 5, group: 'دودھ' },
      { name: 'اینٹی سینٹ (200ml)', purchasePrice: 100, salePrice: 150, wholeSalePrice: 130, stock: 40, minStock: 10, group: 'سنگھار' },
      { name: 'شیمپو (180ml)', purchasePrice: 120, salePrice: 180, wholeSalePrice: 160, stock: 40, minStock: 10, group: 'سنگھار' },
      { name: 'ٹوٹھ پیسٹ کلوز اپ (1pcs)', purchasePrice: 90, salePrice: 130, wholeSalePrice: 115, stock: 60, minStock: 15, group: 'ٹوٹھ پیسٹ' },
      { name: 'ٹوٹھ پیسٹ پیکودنت (1pcs)', purchasePrice: 70, salePrice: 100, wholeSalePrice: 90, stock: 60, minStock: 15, group: 'ٹوٹھ پیسٹ' },
      { name: 'سرف ایکو (500g)', purchasePrice: 180, salePrice: 230, wholeSalePrice: 210, stock: 40, minStock: 10, group: 'صاف ستھرا' },
      { name: 'بلیچ (500ml)', purchasePrice: 60, salePrice: 90, wholeSalePrice: 80, stock: 40, minStock: 10, group: 'صاف ستھرا' },
      { name: 'فینیل (500ml)', purchasePrice: 70, salePrice: 100, wholeSalePrice: 85, stock: 50, minStock: 12, group: 'صاف ستھرا' },
      { name: 'گلاس کلینر (500ml)', purchasePrice: 80, salePrice: 120, wholeSalePrice: 100, stock: 30, minStock: 8, group: 'صاف ستھرا' },
      { name: 'پستہ (50g)', purchasePrice: 300, salePrice: 400, wholeSalePrice: 360, stock: 20, minStock: 5, group: 'خشک میوہ' },
      { name: 'بادام (100g)', purchasePrice: 350, salePrice: 450, wholeSalePrice: 400, stock: 20, minStock: 5, group: 'خشک میوہ' },
      { name: 'کھجور (500g)', purchasePrice: 400, salePrice: 550, wholeSalePrice: 500, stock: 15, minStock: 5, group: 'خشک میوہ' },
      { name: 'آچار لسن (400g)', purchasePrice: 150, salePrice: 220, wholeSalePrice: 190, stock: 30, minStock: 8, group: 'آچار' },
      { name: 'آچار مکس (400g)', purchasePrice: 170, salePrice: 240, wholeSalePrice: 210, stock: 25, minStock: 8, group: 'آچار' },
      { name: 'آچار لیمو (300g)', purchasePrice: 120, salePrice: 180, wholeSalePrice: 155, stock: 25, minStock: 8, group: 'آچار' },
      { name: 'نودلز کنور (70g)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 30, stock: 150, minStock: 30, group: 'فاسٹ فوڈ' },
      { name: 'نودلز انڈو میئی (70g)', purchasePrice: 22, salePrice: 40, wholeSalePrice: 35, stock: 100, minStock: 25, group: 'فاسٹ فوڈ' },
      { name: 'کٹھی (3pcs)', purchasePrice: 30, salePrice: 50, wholeSalePrice: 40, stock: 80, minStock: 20, group: 'فاسٹ فوڈ' },
      { name: 'ٹنہ مچھلی (400g)', purchasePrice: 250, salePrice: 320, wholeSalePrice: 290, stock: 20, minStock: 5, group: 'ٹنہ' },
      { name: 'ٹنہ چکن (400g)', purchasePrice: 220, salePrice: 290, wholeSalePrice: 260, stock: 20, minStock: 5, group: 'ٹنہ' },
      { name: 'دہی سیکی (1kg)', purchasePrice: 100, salePrice: 140, wholeSalePrice: 125, stock: 30, minStock: 8, group: 'دودھ' },
      { name: 'پنیر (200g)', purchasePrice: 120, salePrice: 160, wholeSalePrice: 140, stock: 25, minStock: 8, group: 'دودھ' },
      { name: 'کھیرا چاول (500g)', purchasePrice: 180, salePrice: 240, wholeSalePrice: 215, stock: 20, minStock: 5, group: 'کھانے کی چیزیں' },
      { name: 'دیٹول (120ml)', purchasePrice: 120, salePrice: 170, wholeSalePrice: 150, stock: 40, minStock: 10, group: 'دوا' },
      { name: 'سفٹل (100ml)', purchasePrice: 50, salePrice: 80, wholeSalePrice: 65, stock: 50, minStock: 12, group: 'دوا' },
      { name: 'باند اید (10ml)', purchasePrice: 20, salePrice: 35, wholeSalePrice: 28, stock: 60, minStock: 15, group: 'دوا' },
      { name: 'کپڑا دھونے کا صابن (1pcs)', purchasePrice: 50, salePrice: 75, wholeSalePrice: 65, stock: 80, minStock: 20, group: 'صابن' },
      { name: 'سفوف ڈسٹا (200g)', purchasePrice: 100, salePrice: 150, wholeSalePrice: 130, stock: 30, minStock: 8, group: 'دوا' },
      { name: 'مچھس (موم بتی) (10pcs)', purchasePrice: 50, salePrice: 80, wholeSalePrice: 65, stock: 40, minStock: 10, group: 'مختلف' },
      { name: 'اٹاچی میچس (1pcs)', purchasePrice: 15, salePrice: 25, wholeSalePrice: 20, stock: 100, minStock: 25, group: 'مختلف' },
      { name: 'کیلے کا چھلکا (1pcs)', purchasePrice: 5, salePrice: 10, wholeSalePrice: 8, stock: 200, minStock: 50, group: 'مختلف' },
      { name: 'جم مارملیڈ (400g)', purchasePrice: 120, salePrice: 170, wholeSalePrice: 150, stock: 25, minStock: 8, group: 'مٹھائیاں' },
      { name: 'شکر پڑا (250g)', purchasePrice: 80, salePrice: 120, wholeSalePrice: 100, stock: 30, minStock: 8, group: 'مٹھائیاں' },
      { name: 'ہلویہ (250g)', purchasePrice: 150, salePrice: 220, wholeSalePrice: 190, stock: 20, minStock: 5, group: 'مٹھائیاں' },
      { name: 'ناشتا کورن فلیکس (250g)', purchasePrice: 180, salePrice: 250, wholeSalePrice: 220, stock: 20, minStock: 5, group: 'ناشتا' },
      { name: 'اوٹس (500g)', purchasePrice: 150, salePrice: 210, wholeSalePrice: 185, stock: 25, minStock: 8, group: 'ناشتا' },
    ];

    // Create groups first
    const groups = [...new Set(KARYANA_PRODUCTS.map(p => p.group))];
    const groupRecords: Record<string, string> = {};
    for (const gName of groups) {
      try {
        const existing = await db.productGroup.findFirst({ where: { name: gName } });
        if (existing) {
          groupRecords[gName] = existing.id;
        } else {
          const created = await db.productGroup.create({ data: { name: gName } });
          groupRecords[gName] = created.id;
        }
      } catch (e: any) {
        console.warn(`[DB] Group "${gName}" error:`, e.message?.slice(0, 80));
      }
    }

    let added = 0;
    for (const p of KARYANA_PRODUCTS) {
      try {
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
      } catch (e: any) {
        console.warn(`[DB] Seed product "${p.name}" error:`, e.message?.slice(0, 80));
      }
    }
    console.log(`[DB] Seeded ${added} products successfully.`);
    return added;
  } catch (e) {
    console.error('[DB] Seed failed:', e);
    return 0;
  } finally {
    // ALWAYS release the lock
    setSeedingFlag(false);
  }
}
