import { db } from '@/lib/db';
import { ensureDatabase, ensureAdminUser, ensureProductsSeeded } from '@/lib/db-init';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // CRITICAL: Ensure database is initialized before any query
    await ensureDatabase();
    await ensureAdminUser();
    await ensureProductsSeeded();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's sales total
    const todaySalesResult = await db.sale.aggregate({
      _sum: { total: true },
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });
    const todaySales = todaySalesResult._sum.total || 0;

    // Today's purchases total
    const todayPurchasesResult = await db.purchase.aggregate({
      _sum: { total: true },
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });
    const todayPurchases = todayPurchasesResult._sum.total || 0;

    // Total active products
    const totalProducts = await db.product.count({
      where: { isActive: true },
    });

    // Total active customers
    const totalCustomers = await db.customer.count({
      where: { isActive: true },
    });

    // Low stock products - fetch all and filter in JS (Prisma can't compare two fields)
    const allActiveProducts = await db.product.findMany({
      where: { isActive: true },
      include: { subCategory: true, group: true, unit: true },
    });
    const lowStockProducts = allActiveProducts
      .filter(p => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock);

    // Recent sales (last 5)
    const recentSales = await db.sale.findMany({
      take: 5,
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Today's expenses
    const todayExpensesResult = await db.expense.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    });
    const totalExpenses = todayExpensesResult._sum.amount || 0;

    // Total stock value (reuse allActiveProducts from above)
    const totalStockValue = allActiveProducts.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0);

    // Today's profit (sale total - cost of items sold today)
    const todaySalesItems = await db.saleItem.findMany({
      where: { sale: { createdAt: { gte: todayStart, lte: todayEnd } } },
      include: { product: { select: { purchasePrice: true } } },
    });
    const todayCost = todaySalesItems.reduce((sum, item) => {
      return sum + (item.quantity * (item.product?.purchasePrice || 0));
    }, 0);
    const todayProfit = todaySales - todayCost;

    return NextResponse.json({
      todaySales,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStockProducts,
      recentSales,
      totalExpenses,
      totalStockValue,
      todayProfit,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}