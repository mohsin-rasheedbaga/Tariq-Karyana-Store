import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    // Build date filter if provided
    const dateWhere: any = {};
    if (startDate || endDate) {
      dateWhere.createdAt = {};
      if (startDate) dateWhere.createdAt.gte = new Date(startDate + 'T00:00:00');
      if (endDate) dateWhere.createdAt.lte = new Date(endDate + 'T23:59:59.999');
    }

    // Fetch customer info
    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch all transactions in parallel
    const salesWhere: any = { customerId };
    if (Object.keys(dateWhere).length > 0) Object.assign(salesWhere, dateWhere);

    const returnsWhere: any = { customerId };
    if (Object.keys(dateWhere).length > 0) Object.assign(returnsWhere, dateWhere);

    const receivesWhere: any = { customerId };
    if (Object.keys(dateWhere).length > 0) Object.assign(receivesWhere, dateWhere);

    const [sales, returns, cashReceives] = await Promise.all([
      db.sale.findMany({
        where: salesWhere,
        orderBy: { createdAt: 'asc' },
      }),
      db.saleReturn.findMany({
        where: returnsWhere,
        orderBy: { createdAt: 'asc' },
      }),
      db.cashReceive.findMany({
        where: receivesWhere,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Build ledger entries
    interface LedgerEntry {
      date: string;
      type: 'sale' | 'return' | 'payment';
      invoiceNo: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }

    const entries: LedgerEntry[] = [];

    // Process sales (debit - increases balance)
    for (const s of sales) {
      entries.push({
        date: s.createdAt.toISOString(),
        type: 'sale',
        invoiceNo: s.invoiceNo,
        description: `Sale - ${s.saleType}`,
        debit: s.total,
        credit: 0,
        balance: 0, // calculated below
      });
    }

    // Process returns (credit - decreases balance)
    for (const r of returns) {
      entries.push({
        date: r.createdAt.toISOString(),
        type: 'return',
        invoiceNo: r.returnNo,
        description: r.originalInvoiceNo ? `Return against ${r.originalInvoiceNo}` : 'Sale Return',
        debit: 0,
        credit: r.total,
        balance: 0,
      });
    }

    // Process cash received (credit - decreases balance)
    for (const cr of cashReceives) {
      entries.push({
        date: cr.createdAt.toISOString(),
        type: 'payment',
        invoiceNo: '-',
        description: cr.description || 'Cash Received',
        debit: 0,
        credit: cr.amount,
        balance: 0,
      });
    }

    // Sort by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    // If date range is specified, use customer's current balance minus future transactions
    // For simplicity, calculate from opening balance + all entries
    let runningBalance = customer.openingBalance || 0;

    // If we have a start date filter, we need to calculate the balance at the start
    if (startDate) {
      // Get all transactions before start date to compute opening balance for the period
      const beforeDateFilter = { customerId, createdAt: { lt: new Date(startDate + 'T00:00:00') } };
      const [prevSales, prevReturns, prevReceives] = await Promise.all([
        db.sale.findMany({ where: beforeDateFilter }),
        db.saleReturn.findMany({ where: beforeDateFilter }),
        db.cashReceive.findMany({ where: beforeDateFilter }),
      ]);
      const prevDebit = prevSales.reduce((sum, s) => sum + s.total, 0);
      const prevCredit = prevReturns.reduce((sum, r) => sum + r.total, 0) + prevReceives.reduce((sum, r) => sum + r.amount, 0);
      runningBalance = (customer.openingBalance || 0) + prevDebit - prevCredit;
    }

    for (const entry of entries) {
      runningBalance = runningBalance + entry.debit - entry.credit;
      entry.balance = runningBalance;
    }

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
    const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance : runningBalance;

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        accountNo: customer.accountNo,
        phone: customer.phone,
      },
      entries,
      summary: {
        totalDebit,
        totalCredit,
        currentBalance,
      },
    });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch customer ledger' }, { status: 500 });
  }
}