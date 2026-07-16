import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'sales';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    const dateWhere: any = {};
    if (startDate || endDate) {
      dateWhere.createdAt = {};
      if (startDate) dateWhere.createdAt.gte = new Date(startDate + 'T00:00:00');
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59.999');
        dateWhere.createdAt.lte = end;
      }
    }

    switch (type) {
      case 'sales': {
        const sales = await db.sale.findMany({
          where: Object.keys(dateWhere).length > 0 ? dateWhere : undefined,
          include: { customer: true, items: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const totalAmount = sales.reduce((sum, s) => sum + s.total, 0);
        const totalDiscount = sales.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
        const totalPaid = sales.reduce((sum, s) => sum + (s.paid || 0), 0);
        return NextResponse.json({
          type: 'sales',
          items: sales,
          summary: { totalAmount, totalDiscount, totalPaid, count: sales.length },
        });
      }

      case 'purchase': {
        const purchases = await db.purchase.findMany({
          where: Object.keys(dateWhere).length > 0 ? dateWhere : undefined,
          include: { party: true, items: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const totalAmount = purchases.reduce((sum, p) => sum + p.total, 0);
        const totalPaid = purchases.reduce((sum, p) => sum + (p.paid || 0), 0);
        return NextResponse.json({
          type: 'purchase',
          items: purchases,
          summary: { totalAmount, totalPaid, count: purchases.length },
        });
      }

      case 'expense': {
        const expenses = await db.expense.findMany({
          where: Object.keys(dateWhere).length > 0 ? dateWhere : undefined,
          include: { expenseType: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        // Group by expense type
        const byType: Record<string, number> = {};
        expenses.forEach(e => {
          const name = e.expenseType?.name || 'Other';
          byType[name] = (byType[name] || 0) + e.amount;
        });
        return NextResponse.json({
          type: 'expense',
          items: expenses,
          byType,
          summary: { totalAmount, count: expenses.length },
        });
      }

      case 'stock': {
        const products = await db.product.findMany({
          where: { isActive: true },
          include: { group: true, unit: true },
          orderBy: { name: 'asc' },
        });
        const totalValue = products.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0);
        const totalSaleValue = products.reduce((sum, p) => sum + (p.stock * p.salePrice), 0);
        const lowStock = products.filter(p => p.stock <= p.minStock);
        const outOfStock = products.filter(p => p.stock <= 0);
        return NextResponse.json({
          type: 'stock',
          items: products,
          summary: { totalValue, totalSaleValue, totalProducts: products.length, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length },
        });
      }

      case 'profit': {
        // Sales data with cost calculation
        const sales = await db.sale.findMany({
          where: Object.keys(dateWhere).length > 0 ? dateWhere : undefined,
          include: { items: { include: { product: { select: { purchasePrice: true, name: true } } } }, customer: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });

        let totalSales = 0;
        let totalCost = 0;
        let totalDiscount = 0;

        const saleDetails = sales.map(s => {
          const saleCost = s.items.reduce((sum, item) =>
            sum + (item.quantity * (item.product?.purchasePrice || 0)), 0);
          const saleProfit = s.total - saleCost;
          totalSales += s.total;
          totalCost += saleCost;
          totalDiscount += (s.discountAmount || 0);
          return {
            id: s.id,
            invoiceNo: s.invoiceNo,
            customerName: s.customer?.name || '-',
            total: s.total,
            cost: saleCost,
            profit: saleProfit,
            date: s.createdAt,
          };
        });

        const grossProfit = totalSales - totalCost;

        // Expenses in same period
        const expenses = await db.expense.findMany({
          where: Object.keys(dateWhere).length > 0 ? dateWhere : undefined,
        });
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        const netProfit = grossProfit - totalExpenses;

        return NextResponse.json({
          type: 'profit',
          items: saleDetails,
          summary: { totalSales, totalCost, grossProfit, totalDiscount, totalExpenses, netProfit, salesCount: sales.length },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}