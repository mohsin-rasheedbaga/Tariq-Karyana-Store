import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
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

    // Low stock products
    const lowStockProducts = await db.product.findMany({
      where: {
        isActive: true,
        stock: { lte: db.product.fields.minStock },
      },
      include: {
        subCategory: true,
        group: true,
        unit: true,
      },
      orderBy: { stock: 'asc' },
    });

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
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });
    const totalExpenses = todayExpensesResult._sum.amount || 0;

    return NextResponse.json({
      todaySales,
      todayPurchases,
      totalProducts,
      totalCustomers,
      lowStockProducts,
      recentSales,
      totalExpenses,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}