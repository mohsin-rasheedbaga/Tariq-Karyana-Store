import { db } from '@/lib/db';
import { ensureDatabase, ensureAdminUser, ensureProductsSeeded } from '@/lib/db-init';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await ensureDatabase();
    await ensureAdminUser();
    // Run seed in background (don't block dashboard load)
    ensureProductsSeeded().catch(e => console.error('[Dashboard] Seed bg error:', e));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const dateFilter = { gte: todayStart, lte: todayEnd };

    // Each query wrapped independently so one failure doesn't break the rest
    let todaySales = 0;
    try {
      const r = await db.sale.aggregate({ _sum: { total: true }, where: { createdAt: dateFilter } });
      todaySales = r._sum.total || 0;
    } catch (e: any) { console.error('[Dashboard] todaySales failed:', e.message?.slice(0, 80)); }

    let todayPurchases = 0;
    try {
      const r = await db.purchase.aggregate({ _sum: { total: true }, where: { createdAt: dateFilter } });
      todayPurchases = r._sum.total || 0;
    } catch (e: any) { console.error('[Dashboard] todayPurchases failed:', e.message?.slice(0, 80)); }

    let totalProducts = 0;
    try {
      totalProducts = await db.product.count({ where: { isActive: true } });
    } catch (e: any) { console.error('[Dashboard] totalProducts failed:', e.message?.slice(0, 80)); }

    let totalCustomers = 0;
    try {
      totalCustomers = await db.customer.count({ where: { isActive: true } });
    } catch (e: any) { console.error('[Dashboard] totalCustomers failed:', e.message?.slice(0, 80)); }

    let lowStockProducts: any[] = [];
    try {
      const all = await db.product.findMany({ where: { isActive: true } });
      lowStockProducts = all.filter(p => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock).slice(0, 20);
    } catch (e: any) { console.error('[Dashboard] lowStock failed:', e.message?.slice(0, 80)); }

    let recentSales: any[] = [];
    try {
      recentSales = await db.sale.findMany({
        take: 5, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } }, items: { select: { id: true } } },
      });
    } catch (e: any) { console.error('[Dashboard] recentSales failed:', e.message?.slice(0, 80)); }

    let totalExpenses = 0;
    try {
      const r = await db.expense.aggregate({ _sum: { amount: true }, where: { createdAt: dateFilter } });
      totalExpenses = r._sum.amount || 0;
    } catch (e: any) { console.error('[Dashboard] expenses failed:', e.message?.slice(0, 80)); }

    let totalStockValue = 0;
    try {
      const prods = await db.product.findMany({ where: { isActive: true }, select: { stock: true, purchasePrice: true } });
      totalStockValue = prods.reduce((s, p) => s + (p.stock * p.purchasePrice), 0);
    } catch (e: any) { console.error('[Dashboard] stockValue failed:', e.message?.slice(0, 80)); }

    let todayProfit = 0;
    try {
      const saleItems = await db.saleItem.findMany({
        where: { sale: { createdAt: dateFilter } },
        include: { product: { select: { purchasePrice: true } } },
      });
      const cost = saleItems.reduce((s, i) => s + (i.quantity * (i.product?.purchasePrice || 0)), 0);
      todayProfit = todaySales - cost;
    } catch (e: any) { console.error('[Dashboard] profit failed:', e.message?.slice(0, 80)); }

    return NextResponse.json({
      todaySales, todayPurchases, totalProducts, totalCustomers,
      lowStockProducts, recentSales, totalExpenses, totalStockValue, todayProfit,
    });
  } catch (error) {
    console.error('[Dashboard] Fatal error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}