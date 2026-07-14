'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Receipt, Package, TrendingUp, DollarSign,
  Calendar, Printer, FileText, Download, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type ReportType = 'sales' | 'purchase' | 'stock' | 'profit' | 'expense';

interface ReportData {
  type: string;
  items: any[];
  summary: Record<string, any>;
  byType?: Record<string, number>;
}

const reportTypes: { value: ReportType; key: string; icon: React.ReactNode; color: string }[] = [
  { value: 'sales', key: 'rpt.sales_report', icon: <ShoppingCart className="h-5 w-5" />, color: 'text-emerald-600' },
  { value: 'purchase', key: 'rpt.purchase_report', icon: <Receipt className="h-5 w-5" />, color: 'text-blue-600' },
  { value: 'stock', key: 'rpt.stock_report', icon: <Package className="h-5 w-5" />, color: 'text-purple-600' },
  { value: 'profit', key: 'rpt.profit_report', icon: <TrendingUp className="h-5 w-5" />, color: 'text-amber-600' },
  { value: 'expense', key: 'rpt.expense_report', icon: <DollarSign className="h-5 w-5" />, color: 'text-red-600' },
];

export function ReportsPage() {
  const { lang, theme } = useAppStore();
  const isDark = theme === 'dark';
  const printRef = useRef<HTMLDivElement>(null);

  const [reportType, setReportType] = useState<ReportType>('sales');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState<'start' | 'end' | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (startDate) params.set('startDate', startDate.toISOString().split('T')[0]);
      if (endDate) params.set('endDate', endDate.toISOString().split('T')[0]);

      const res = await fetch(`/api/reports?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const content = printRef.current.innerHTML;
    const dir = lang === 'ur' ? 'rtl' : 'ltr';
    printWindow.document.write(`<!DOCTYPE html><html dir="${dir}"><head>
      <meta charset="UTF-8">
      <title>${t(`rpt.${reportType}_report`, lang)} - Tariq Store</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 13px; }
        h2 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 12px; margin-bottom: 16px; }
        .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
        .summary-item { background: #f1f5f9; padding: 8px 14px; border-radius: 8px; font-size: 12px; }
        .summary-item strong { display: block; font-size: 14px; color: #0f172a; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .red { color: #ef4444; font-weight: 600; }
        .green { color: #16a34a; font-weight: 600; }
        @media print { body { padding: 10px; } .no-print { display: none; } }
      </style>
    </head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const clearDates = () => { setStartDate(undefined); setEndDate(undefined); };
  const today = new Date().toISOString().split('T')[0];

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  };
  const fmtNum = (n: number) => `${t('common.currency', lang)} ${Number(n || 0).toLocaleString()}`;

  // Date range label
  const dateLabel = startDate || endDate
    ? `${startDate ? fmtDate(startDate.toISOString()) : '...'} — ${endDate ? fmtDate(endDate.toISOString()) : '...'}`
    : t('rpt.all_dates', lang);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('rpt.title', lang)}</h2>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handlePrint} disabled={!data || loading}>
          <Printer className="h-4 w-4" /> {t('rpt.print', lang)}
        </Button>
      </div>

      {/* Report Type Selector Cards */}
      <div className="flex flex-wrap gap-2">
        {reportTypes.map(rt => (
          <button
            key={rt.value}
            onClick={() => setReportType(rt.value)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border-2",
              reportType === rt.value
                ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                : isDark
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
            )}
          >
            <span className={reportType === rt.value ? 'text-emerald-600' : rt.color}>{rt.icon}</span>
            {t(rt.key, lang)}
          </button>
        ))}
      </div>

      {/* Date Range Controls */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">{t('rpt.date_range', lang)}:</span>

            {/* Start Date */}
            <Popover open={calendarOpen === 'start'} onOpenChange={o => setCalendarOpen(o ? 'start' : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  {startDate ? fmtDate(startDate.toISOString()) : t('rpt.start_date', lang)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI
                  mode="single"
                  selected={startDate}
                  onSelect={d => { setStartDate(d); setCalendarOpen(null); }}
                  defaultMonth={startDate || new Date()}
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground">—</span>

            {/* End Date */}
            <Popover open={calendarOpen === 'end'} onOpenChange={o => setCalendarOpen(o ? 'end' : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  {endDate ? fmtDate(endDate.toISOString()) : t('rpt.end_date', lang)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI
                  mode="single"
                  selected={endDate}
                  onSelect={d => { setEndDate(d); setCalendarOpen(null); }}
                  defaultMonth={endDate || startDate || new Date()}
                />
              </PopoverContent>
            </Popover>

            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearDates}>
                <X className="h-3 w-3" />
              </Button>
            )}

            <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={loadReport} disabled={loading}>
              <FileText className="h-3.5 w-3.5" /> {t('rpt.generate', lang)}
            </Button>

            <span className="text-xs text-muted-foreground ml-auto">{dateLabel}</span>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-muted-foreground">{t('rpt.loading', lang)}</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm">{error}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={loadReport}>
            {t('dash.retry', lang) || 'Retry'}
          </Button>
        </div>
      )}

      {/* Report Content */}
      {!loading && !error && data && (
        <div ref={printRef}>
          {/* Print Header */}
          <div className="no-print" />
          <h2 className="text-lg font-bold mb-0">{t(`rpt.${reportType}_report`, lang)}</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {t('rpt.date_range', lang)}: {dateLabel}
          </p>

          {/* Summary Cards */}
          {data.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              {renderSummaryCards(reportType, data.summary)}
            </div>
          )}

          {/* Expense by Type (only for expense report) */}
          {reportType === 'expense' && data.byType && Object.keys(data.byType).length > 0 && (
            <Card className={cn("mb-4", isDark && 'bg-slate-800 border-slate-700')}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('rpt.by_type', lang)}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(data.byType).map(([name, amount]) => (
                    <div key={name} className={cn("p-2 rounded-lg text-sm", isDark ? 'bg-slate-700' : 'bg-slate-50')}>
                      <span className="text-muted-foreground">{name}</span>
                      <span className="float-right font-semibold">{fmtNum(amount as number)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Table */}
          <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn("border-b", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
                      {renderTableHeader(reportType)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr><td colSpan={20} className="text-center py-8 text-muted-foreground">{t('rpt.no_data', lang)}</td></tr>
                    ) : data.items.map((item: any, idx: number) => (
                      <tr key={item.id || idx} className={cn("border-b", isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50')}>
                        {renderTableRow(reportType, item)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  // --- Render Helpers ---

  function renderSummaryCards(type: ReportType, summary: Record<string, any>) {
    const cards: { label: string; value: string; color?: string }[] = [];

    switch (type) {
      case 'sales':
        cards.push(
          { label: t('rpt.count', lang), value: String(summary.count || 0) },
          { label: t('rpt.total', lang), value: fmtNum(summary.totalAmount) },
          { label: t('rpt.discount', lang), value: fmtNum(summary.totalDiscount) },
          { label: t('rpt.paid', lang), value: fmtNum(summary.totalPaid) },
          { label: t('rpt.balance', lang), value: fmtNum(summary.totalAmount - summary.totalPaid) },
        );
        break;
      case 'purchase':
        cards.push(
          { label: t('rpt.count', lang), value: String(summary.count || 0) },
          { label: t('rpt.total', lang), value: fmtNum(summary.totalAmount) },
          { label: t('rpt.paid', lang), value: fmtNum(summary.totalPaid) },
          { label: t('rpt.balance', lang), value: fmtNum(summary.totalAmount - summary.totalPaid) },
        );
        break;
      case 'expense':
        cards.push(
          { label: t('rpt.count', lang), value: String(summary.count || 0) },
          { label: t('rpt.total', lang), value: fmtNum(summary.totalAmount) },
        );
        break;
      case 'stock':
        cards.push(
          { label: t('rpt.count', lang), value: String(summary.totalProducts || 0) },
          { label: t('rpt.total_value', lang), value: fmtNum(summary.totalValue) },
          { label: t('rpt.sale_value', lang), value: fmtNum(summary.totalSaleValue) },
          { label: t('rpt.low_stock', lang), value: String(summary.lowStockCount || 0), color: 'text-amber-600' },
          { label: t('rpt.out_of_stock', lang), value: String(summary.outOfStockCount || 0), color: 'text-red-600' },
        );
        break;
      case 'profit':
        cards.push(
          { label: t('rpt.count', lang), value: String(summary.salesCount || 0) },
          { label: t('rpt.total_sales', lang), value: fmtNum(summary.totalSales), color: 'text-emerald-600' },
          { label: t('rpt.total_cost', lang), value: fmtNum(summary.totalCost) },
          { label: t('rpt.gross_profit', lang), value: fmtNum(summary.grossProfit), color: 'text-blue-600' },
          { label: t('rpt.net_profit', lang), value: fmtNum(summary.netProfit), color: summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: t('rpt.total_expenses', lang), value: fmtNum(summary.totalExpenses), color: 'text-red-600' },
        );
        break;
    }

    return cards.map((c, i) => (
      <div key={i} className={cn("rounded-lg p-3", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
        <p className="text-[11px] text-muted-foreground">{c.label}</p>
        <p className={cn("text-base font-bold mt-0.5", c.color)}>{c.value}</p>
      </div>
    ));
  }

  function renderTableHeader(type: ReportType) {
    switch (type) {
      case 'sales':
        return (
          <>
            <th className="text-left p-3 font-medium">#</th>
            <th className="text-left p-3 font-medium">{t('rpt.invoice_no', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.customer', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.type', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.total', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.paid', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.balance', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.date', lang)}</th>
          </>
        );
      case 'purchase':
        return (
          <>
            <th className="text-left p-3 font-medium">#</th>
            <th className="text-left p-3 font-medium">{t('rpt.invoice_no', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.party', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.total', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.paid', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.balance', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.date', lang)}</th>
          </>
        );
      case 'expense':
        return (
          <>
            <th className="text-left p-3 font-medium">#</th>
            <th className="text-left p-3 font-medium">{t('rpt.date', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.expense_type', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.description', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.amount', lang)}</th>
          </>
        );
      case 'stock':
        return (
          <>
            <th className="text-left p-3 font-medium">#</th>
            <th className="text-left p-3 font-medium">{t('rpt.product', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.group', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.purchase_price', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.sale_price', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.stock_qty', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.min_stock', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.total_value', lang)}</th>
          </>
        );
      case 'profit':
        return (
          <>
            <th className="text-left p-3 font-medium">#</th>
            <th className="text-left p-3 font-medium">{t('rpt.invoice_no', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.customer', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.total_sales', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.cost', lang)}</th>
            <th className="text-right p-3 font-medium">{t('rpt.profit', lang)}</th>
            <th className="text-left p-3 font-medium">{t('rpt.date', lang)}</th>
          </>
        );
    }
  }

  function renderTableRow(type: ReportType, item: any) {
    switch (type) {
      case 'sales':
        return (
          <>
            <td className="p-3 text-xs text-muted-foreground">{item.items?.length || 0} {t('rpt.items', lang)}</td>
            <td className="p-3 font-mono text-xs font-semibold">{item.invoiceNo}</td>
            <td className="p-3">{item.customer?.name || '-'}</td>
            <td className="p-3"><Badge variant="secondary" className="text-xs">{item.saleType === 'cash' ? t('rpt.cash', lang) : t('rpt.credit', lang)}</Badge></td>
            <td className="p-3 text-right font-semibold text-emerald-600">{fmtNum(item.total)}</td>
            <td className="p-3 text-right">{fmtNum(item.paid || 0)}</td>
            <td className="p-3 text-right font-semibold text-red-500">{fmtNum(item.total - (item.paid || 0))}</td>
            <td className="p-3 text-xs text-muted-foreground">{fmtDate(item.createdAt)}</td>
          </>
        );
      case 'purchase':
        return (
          <>
            <td className="p-3 text-xs text-muted-foreground">{item.items?.length || 0} {t('rpt.items', lang)}</td>
            <td className="p-3 font-mono text-xs font-semibold">{item.invoiceNo}</td>
            <td className="p-3">{item.party?.name || '-'}</td>
            <td className="p-3 text-right font-semibold text-blue-600">{fmtNum(item.total)}</td>
            <td className="p-3 text-right">{fmtNum(item.paid || 0)}</td>
            <td className="p-3 text-right font-semibold text-red-500">{fmtNum(item.total - (item.paid || 0))}</td>
            <td className="p-3 text-xs text-muted-foreground">{fmtDate(item.createdAt)}</td>
          </>
        );
      case 'expense':
        return (
          <>
            <td className="p-3 text-xs text-muted-foreground">{item.expenseType?.name || '-'}</td>
            <td className="p-3 text-xs">{fmtDate(item.createdAt)}</td>
            <td className="p-3"><Badge variant="secondary" className="text-xs">{item.expenseType?.name || '-'}</Badge></td>
            <td className="p-3 text-sm">{item.description || '-'}</td>
            <td className="p-3 text-right font-semibold text-red-600">{fmtNum(item.amount)}</td>
          </>
        );
      case 'stock':
        return (
          <>
            <td className="p-3 text-xs text-muted-foreground">{item.barcode}</td>
            <td className="p-3 font-medium">{item.name}</td>
            <td className="p-3"><Badge variant="secondary" className="text-xs">{item.group?.name || '-'}</Badge></td>
            <td className="p-3 text-right">{fmtNum(item.purchasePrice)}</td>
            <td className="p-3 text-right font-semibold text-emerald-600">{fmtNum(item.salePrice)}</td>
            <td className={cn("p-3 text-right font-semibold", item.stock <= 0 ? "text-red-600" : item.stock <= item.minStock ? "text-amber-600" : "")}>{item.stock}</td>
            <td className="p-3 text-right text-muted-foreground">{item.minStock}</td>
            <td className="p-3 text-right">{fmtNum(item.stock * item.purchasePrice)}</td>
          </>
        );
      case 'profit':
        return (
          <>
            <td className="p-3 text-xs text-muted-foreground">{item.id?.slice(0, 8)}...</td>
            <td className="p-3 font-mono text-xs font-semibold">{item.invoiceNo}</td>
            <td className="p-3">{item.customerName}</td>
            <td className="p-3 text-right font-semibold text-emerald-600">{fmtNum(item.total)}</td>
            <td className="p-3 text-right">{fmtNum(item.cost)}</td>
            <td className={cn("p-3 text-right font-bold", item.profit >= 0 ? "text-emerald-600" : "text-red-600")}>{fmtNum(item.profit)}</td>
            <td className="p-3 text-xs text-muted-foreground">{fmtDate(item.date)}</td>
          </>
        );
    }
  }
}