import { db } from '@/lib/db';
import { ensureDatabase } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const startOfDay = new Date(dateStr + 'T00:00:00');
    const endOfDay = new Date(dateStr + 'T23:59:59.999');

    const dateFilter = { createdAt: { gte: startOfDay, lte: endOfDay } };

    // Fetch all data for the given day in parallel
    const [sales, purchases, expenses, cashReceives, cashPayments] = await Promise.all([
      db.sale.findMany({
        where: dateFilter,
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchase.findMany({
        where: dateFilter,
        include: { party: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.expense.findMany({
        where: dateFilter,
        include: { expenseType: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.cashReceive.findMany({
        where: dateFilter,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.cashPayment.findMany({
        where: dateFilter,
        include: { party: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calculate summaries
    const cashSales = sales.filter(s => s.saleType === 'cash').reduce((sum, s) => sum + s.total, 0);
    const creditSales = sales.filter(s => s.saleType === 'credit' || s.saleType === 'wholeSale').reduce((sum, s) => sum + s.total, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalReceived = cashReceives.reduce((sum, r) => sum + r.amount, 0);
    const totalPaid = cashPayments.reduce((sum, p) => sum + p.amount, 0);

    // Opening cash = previous day's closing (cash sales - cash purchase payments - expenses + received)
    const prevDay = new Date(startOfDay);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStart = new Date(prevDay);
    prevDayStart.setHours(0, 0, 0, 0);
    const prevDayEnd = new Date(prevDay);
    prevDayEnd.setHours(23, 59, 59, 999);
    const prevDayFilter = { createdAt: { gte: prevDayStart, lte: prevDayEnd } };

    const [prevSales, prevPurchases, prevExpenses, prevReceives, prevPayments] = await Promise.all([
      db.sale.findMany({ where: prevDayFilter }),
      db.purchase.findMany({ where: prevDayFilter }),
      db.expense.findMany({ where: prevDayFilter }),
      db.cashReceive.findMany({ where: prevDayFilter }),
      db.cashPayment.findMany({ where: prevDayFilter }),
    ]);

    const prevCashSales = prevSales.filter(s => s.saleType === 'cash').reduce((sum, s) => sum + s.total, 0);
    const prevCashPaid = prevPurchases.filter(p => p.purchaseType === 'cash').reduce((sum, p) => sum + (p.paid || 0), 0);
    const prevExpensesTotal = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
    const prevReceivedTotal = prevReceives.reduce((sum, r) => sum + r.amount, 0);
    const prevPaymentsTotal = prevPayments.reduce((sum, p) => sum + p.amount, 0);

    const openingCash = prevCashSales + prevReceivedTotal - prevCashPaid - prevExpensesTotal - prevPaymentsTotal;
    const netCash = openingCash + cashSales + totalReceived - totalPaid - totalExpenses;

    return NextResponse.json({
      date: dateStr,
      summary: {
        cashSales,
        creditSales,
        totalPurchases,
        totalExpenses,
        totalReceived,
        totalPaid,
        openingCash,
        netCash,
        saleCount: sales.length,
        purchaseCount: purchases.length,
      },
      details: {
        sales: sales.map(s => ({
          id: s.id,
          invoiceNo: s.invoiceNo,
          customerName: s.customer?.name || '-',
          saleType: s.saleType,
          total: s.total,
          paid: s.paid,
          createdAt: s.createdAt,
        })),
        purchases: purchases.map(p => ({
          id: p.id,
          invoiceNo: p.invoiceNo,
          partyName: p.party?.name || '-',
          purchaseType: p.purchaseType,
          total: p.total,
          paid: p.paid,
          createdAt: p.createdAt,
        })),
        expenses: expenses.map(e => ({
          id: e.id,
          typeName: e.expenseType?.name || '-',
          amount: e.amount,
          description: e.description,
          createdAt: e.createdAt,
        })),
        cashReceives: cashReceives.map(r => ({
          id: r.id,
          customerName: r.customer?.name || '-',
          amount: r.amount,
          description: r.description,
          createdAt: r.createdAt,
        })),
        cashPayments: cashPayments.map(p => ({
          id: p.id,
          partyName: p.party?.name || '-',
          amount: p.amount,
          description: p.description,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching daily closing:', error);
    return NextResponse.json({ error: 'Failed to fetch daily closing data' }, { status: 500 });
  }
}