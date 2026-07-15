'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CalendarDays, Printer, ArrowDownCircle, ArrowUpCircle,
  ShoppingCart, Truck, DollarSign, Wallet, CreditCard, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface DailyClosingData {
  date: string;
  summary: {
    cashSales: number;
    creditSales: number;
    totalPurchases: number;
    totalExpenses: number;
    totalReceived: number;
    totalPaid: number;
    openingCash: number;
    netCash: number;
    saleCount: number;
    purchaseCount: number;
  };
  details: {
    sales: any[];
    purchases: any[];
    expenses: any[];
    cashReceives: any[];
    cashPayments: any[];
  };
}

export function DailyClosingPage() {
  const { lang, theme } = useAppStore();
  const isDark = theme === 'dark';
  const printRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState<DailyClosingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = t('common.currency', lang);
  const locale = lang === 'ur' ? 'ur-PK' : 'en-US';

  const fmtNum = (n: number) => `${currency} ${Number(n || 0).toLocaleString(locale)}`;
  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(locale, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return d; }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-closing?date=${date}`);
      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try { const j = await res.json(); if (j.error) errMsg = j.error; } catch { /* not JSON */ }
        throw new Error(errMsg);
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const content = printRef.current.innerHTML;
    const dir = lang === 'ur' ? 'rtl' : 'ltr';
    printWindow.document.write(`<!DOCTYPE html><html dir="${dir}"><head>
      <meta charset="UTF-8">
      <title>${t('dc.title', lang)} - Tariq Store</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 13px; }
        h2 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 12px; margin-bottom: 16px; }
        .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
        .summary-item { background: #f1f5f9; padding: 8px 14px; border-radius: 8px; font-size: 12px; min-width: 120px; }
        .summary-item strong { display: block; font-size: 14px; color: #0f172a; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .red { color: #ef4444; font-weight: 600; }
        .green { color: #16a34a; font-weight: 600; }
        h3 { font-size: 14px; margin: 16px 0 8px; color: #334155; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const summaryCards = data ? [
    { label: t('dc.opening_cash', lang), value: fmtNum(data.summary.openingCash), icon: <Wallet className="h-5 w-5" />, color: 'text-slate-500' },
    { label: t('dc.cash_sales', lang), value: fmtNum(data.summary.cashSales), icon: <ArrowDownCircle className="h-5 w-5" />, color: 'text-emerald-600' },
    { label: t('dc.credit_sales', lang), value: fmtNum(data.summary.creditSales), icon: <CreditCard className="h-5 w-5" />, color: 'text-amber-600' },
    { label: t('dc.purchases', lang), value: fmtNum(data.summary.totalPurchases), icon: <Truck className="h-5 w-5" />, color: 'text-blue-600' },
    { label: t('dc.expenses', lang), value: fmtNum(data.summary.totalExpenses), icon: <DollarSign className="h-5 w-5" />, color: 'text-red-600' },
    { label: t('dc.received', lang), value: fmtNum(data.summary.totalReceived), icon: <ArrowDownCircle className="h-5 w-5" />, color: 'text-teal-600' },
    { label: t('dc.payments', lang), value: fmtNum(data.summary.totalPaid), icon: <ArrowUpCircle className="h-5 w-5" />, color: 'text-orange-600' },
    { label: t('dc.net_cash', lang), value: fmtNum(data.summary.netCash), icon: <TrendingUp className="h-5 w-5" />, color: data.summary.netCash >= 0 ? 'text-emerald-600' : 'text-red-600' },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('dc.title', lang)}</h2>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handlePrint} disabled={!data || loading}>
          <Printer className="h-4 w-4" /> {t('dc.print', lang)}
        </Button>
      </div>

      {/* Date Picker */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <label className="text-sm font-medium">{t('dc.date', lang)}</label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={cn("w-44", isDark && 'bg-slate-700 border-slate-600')}
            />
            <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={loadData} disabled={loading}>
              <ShoppingCart className="h-3.5 w-3.5" />
            </Button>
            <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{data?.summary.saleCount || 0} {t('dc.sale_count', lang)}</Badge>
              <Badge variant="secondary">{data?.summary.purchaseCount || 0} {t('dc.purchase_count', lang)}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-muted-foreground">Loading...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm">{error}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={loadData}>Retry</Button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <div ref={printRef}>
          {/* Print Header */}
          <h2 className="text-lg font-bold mb-0">{t('dc.title', lang)}</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {t('dc.date', lang)}: {new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {summaryCards.map((c, i) => (
              <div key={i} className={cn("rounded-lg p-3", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={c.color}>{c.icon}</span>
                  <p className="text-[11px] text-muted-foreground">{c.label}</p>
                </div>
                <p className={cn("text-base font-bold", c.color)}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Sales Table */}
          <DetailTable
            title={t('dc.cash_sales', lang)}
            isDark={isDark}
            columns={[t('dc.invoice', lang) || 'Invoice', t('rpt.customer', lang) || 'Customer', t('rpt.type', lang) || 'Type', t('rpt.total', lang) || 'Total', t('dc.date', lang)]}
            rows={data.details.sales}
            renderRow={(s) => (
              <>
                <td className="p-3 font-mono text-xs font-semibold">{s.invoiceNo}</td>
                <td className="p-3">{s.customerName}</td>
                <td className="p-3"><Badge variant="secondary" className="text-xs">{s.saleType}</Badge></td>
                <td className={cn("p-3 text-right font-semibold", s.saleType === 'cash' ? 'text-emerald-600' : 'text-amber-600')}>{fmtNum(s.total)}</td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(s.createdAt)}</td>
              </>
            )}
            noData={data.details.sales.length === 0}
          />

          {/* Purchases Table */}
          <DetailTable
            title={t('dc.purchases', lang)}
            isDark={isDark}
            columns={['Invoice', t('rpt.party', lang) || 'Vendor', t('rpt.type', lang) || 'Type', t('rpt.total', lang) || 'Total', t('dc.date', lang)]}
            rows={data.details.purchases}
            renderRow={(p) => (
              <>
                <td className="p-3 font-mono text-xs font-semibold">{p.invoiceNo}</td>
                <td className="p-3">{p.partyName}</td>
                <td className="p-3"><Badge variant="secondary" className="text-xs">{p.purchaseType}</Badge></td>
                <td className="p-3 text-right font-semibold text-blue-600">{fmtNum(p.total)}</td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(p.createdAt)}</td>
              </>
            )}
            noData={data.details.purchases.length === 0}
          />

          {/* Expenses Table */}
          <DetailTable
            title={t('dc.expenses', lang)}
            isDark={isDark}
            columns={[t('exp.type', lang) || 'Type', t('rpt.description', lang) || 'Description', t('rpt.amount', lang) || 'Amount', t('dc.date', lang)]}
            rows={data.details.expenses}
            renderRow={(e) => (
              <>
                <td className="p-3"><Badge variant="secondary" className="text-xs">{e.typeName}</Badge></td>
                <td className="p-3 text-muted-foreground">{e.description || '-'}</td>
                <td className="p-3 text-right font-semibold text-red-600">{fmtNum(e.amount)}</td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(e.createdAt)}</td>
              </>
            )}
            noData={data.details.expenses.length === 0}
          />

          {/* Customer Receipts Table */}
          <DetailTable
            title={t('dc.received', lang)}
            isDark={isDark}
            columns={[t('rpt.customer', lang) || 'Customer', t('rpt.amount', lang) || 'Amount', t('rpt.description', lang) || 'Description', t('dc.date', lang)]}
            rows={data.details.cashReceives}
            renderRow={(r) => (
              <>
                <td className="p-3 font-medium">{r.customerName}</td>
                <td className="p-3 text-right font-semibold text-teal-600">{fmtNum(r.amount)}</td>
                <td className="p-3 text-muted-foreground">{r.description || '-'}</td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(r.createdAt)}</td>
              </>
            )}
            noData={data.details.cashReceives.length === 0}
          />

          {/* Vendor Payments Table */}
          <DetailTable
            title={t('dc.payments', lang)}
            isDark={isDark}
            columns={[t('rpt.party', lang) || 'Vendor', t('rpt.amount', lang) || 'Amount', t('rpt.description', lang) || 'Description', t('dc.date', lang)]}
            rows={data.details.cashPayments}
            renderRow={(p) => (
              <>
                <td className="p-3 font-medium">{p.partyName}</td>
                <td className="p-3 text-right font-semibold text-orange-600">{fmtNum(p.amount)}</td>
                <td className="p-3 text-muted-foreground">{p.description || '-'}</td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(p.createdAt)}</td>
              </>
            )}
            noData={data.details.cashPayments.length === 0}
          />

          {/* No data at all */}
          {data.details.sales.length === 0 && data.details.purchases.length === 0 &&
            data.details.expenses.length === 0 && data.details.cashReceives.length === 0 &&
            data.details.cashPayments.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {t('dc.no_data', lang)}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

/* Reusable detail table component */
function DetailTable({ title, isDark, columns, rows, renderRow, noData }: {
  title: string;
  isDark: boolean;
  columns: string[];
  rows: any[];
  renderRow: (row: any) => React.ReactNode;
  noData: boolean;
}) {
  return (
    <Card className={cn("mb-4", isDark && 'bg-slate-800 border-slate-700')}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn('border-b', isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
                <th className="text-left p-3 font-medium text-xs">#</th>
                {columns.map((col, i) => (
                  <th key={i} className={cn("p-3 font-medium text-xs", i === columns.length - 1 ? 'text-left' : i >= columns.length - 2 ? 'text-right' : 'text-left')}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {noData ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-6 text-muted-foreground text-xs">
                    {t('dc.no_data', 'en')}
                  </td>
                </tr>
              ) : rows.map((row, idx) => (
                <tr key={row.id || idx} className={cn('border-b', isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50')}>
                  <td className="p-3 text-xs text-muted-foreground">{idx + 1}</td>
                  {renderRow(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}