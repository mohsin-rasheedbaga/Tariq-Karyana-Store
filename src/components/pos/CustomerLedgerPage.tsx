'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, BookOpen, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  accountNo: string;
  phone?: string;
}

interface LedgerEntry {
  date: string;
  type: 'sale' | 'return' | 'payment';
  invoiceNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerData {
  customer: { id: string; name: string; accountNo: string; phone?: string };
  entries: LedgerEntry[];
  summary: { totalDebit: number; totalCredit: number; currentBalance: number };
}

export function CustomerLedgerPage() {
  const { lang, theme } = useAppStore();
  const isDark = theme === 'dark';
  const printRef = useRef<HTMLDivElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = t('common.currency', lang);
  const locale = lang === 'ur' ? 'ur-PK' : 'en-US';
  const fmtNum = (n: number) => `${currency} ${Number(n || 0).toLocaleString(locale)}`;
  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch { return d; }
  };
  const fmtDateTime = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(locale, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return d; }
  };

  // Load customers list
  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(data => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const loadLedger = useCallback(async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ customerId: selectedCustomerId });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/customer-ledger?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, startDate, endDate]);

  useEffect(() => {
    if (selectedCustomerId) void loadLedger();
  }, [loadLedger, selectedCustomerId]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const content = printRef.current.innerHTML;
    const dir = lang === 'ur' ? 'rtl' : 'ltr';
    printWindow.document.write(`<!DOCTYPE html><html dir="${dir}"><head>
      <meta charset="UTF-8">
      <title>${t('cl.title', lang)} - ${data?.customer.name || ''}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 13px; }
        h2 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 12px; margin-bottom: 16px; }
        .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
        .summary-item { background: #f1f5f9; padding: 8px 14px; border-radius: 8px; font-size: 12px; min-width: 140px; }
        .summary-item strong { display: block; font-size: 14px; color: #0f172a; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .red { color: #ef4444; font-weight: 600; }
        .green { color: #16a34a; font-weight: 600; }
        .blue { color: #2563eb; font-weight: 600; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'sale': return t('cl.sale', lang);
      case 'return': return t('cl.return', lang);
      case 'payment': return t('cl.payment', lang);
      default: return type;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-emerald-100 text-emerald-700';
      case 'return': return 'bg-amber-100 text-amber-700';
      case 'payment': return 'bg-blue-100 text-blue-700';
      default: return '';
    }
  };

  // Filter customers by search
  const filteredCustomers = search
    ? customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search)) ||
        c.accountNo.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('cl.title', lang)}</h2>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handlePrint} disabled={!data || loading}>
          <Printer className="h-4 w-4" /> {t('cl.print', lang)}
        </Button>
      </div>

      {/* Filters */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Customer Search */}
            <div className="sm:col-span-2">
              <Label className="text-xs mb-1 block">{t('cl.select_customer', lang)}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('cl.select_customer', lang)}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={cn("pl-9", isDark && 'bg-slate-700 border-slate-600')}
                />
              </div>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className={cn("mt-2 w-full", isDark && 'bg-slate-700 border-slate-600')}>
                  <SelectValue placeholder={t('cl.select_customer', lang)} />
                </SelectTrigger>
                <SelectContent>
                  {filteredCustomers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.accountNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <Label className="text-xs mb-1 block">{t('cl.date', lang)} ({lang === 'ur' ? 'سے' : 'From'})</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={cn(isDark && 'bg-slate-700 border-slate-600')}
              />
            </div>

            {/* End Date */}
            <div>
              <Label className="text-xs mb-1 block">{t('cl.date', lang)} ({lang === 'ur' ? 'تک' : 'To'})</Label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={cn(isDark && 'bg-slate-700 border-slate-600')}
              />
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
          <Button className="mt-3" size="sm" variant="outline" onClick={loadLedger}>Retry</Button>
        </div>
      )}

      {/* No customer selected */}
      {!selectedCustomerId && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mb-3 opacity-40" />
          <p>{t('cl.select_customer', lang)}</p>
        </div>
      )}

      {/* Ledger Content */}
      {!loading && !error && data && (
        <div ref={printRef}>
          {/* Print Header */}
          <h2 className="text-lg font-bold mb-0">{t('cl.title', lang)}</h2>
          <p className="text-xs text-muted-foreground mb-1">
            {t('rpt.customer', lang)}: {data.customer.name} ({data.customer.accountNo})
            {data.customer.phone && ` — ${data.customer.phone}`}
          </p>
          {(startDate || endDate) && (
            <p className="text-xs text-muted-foreground mb-4">
              {startDate && `${fmtDate(startDate)} ${lang === 'ur' ? 'سے' : 'to'}`}
              {startDate && endDate && ' — '}
              {endDate && fmtDate(endDate)}
            </p>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className={cn("rounded-lg p-3", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
              <p className="text-[11px] text-muted-foreground">{t('cl.total_debit', lang)}</p>
              <p className="text-base font-bold text-red-600">{fmtNum(data.summary.totalDebit)}</p>
            </div>
            <div className={cn("rounded-lg p-3", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
              <p className="text-[11px] text-muted-foreground">{t('cl.total_credit', lang)}</p>
              <p className="text-base font-bold text-emerald-600">{fmtNum(data.summary.totalCredit)}</p>
            </div>
            <div className={cn("rounded-lg p-3", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
              <p className="text-[11px] text-muted-foreground">{t('cl.current_balance', lang)}</p>
              <p className={cn("text-base font-bold", data.summary.currentBalance >= 0 ? 'text-red-600' : 'text-emerald-600')}>
                {fmtNum(data.summary.currentBalance)}
              </p>
            </div>
          </div>

          {/* Ledger Table */}
          <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn('border-b', isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
                      <th className="text-left p-3 font-medium text-xs">#</th>
                      <th className="text-left p-3 font-medium text-xs">{t('cl.date', lang)}</th>
                      <th className="text-left p-3 font-medium text-xs">{t('cl.type', lang)}</th>
                      <th className="text-left p-3 font-medium text-xs">{t('cl.invoice', lang)}</th>
                      <th className="text-left p-3 font-medium text-xs">{t('cl.description', lang)}</th>
                      <th className="text-right p-3 font-medium text-xs">{t('cl.debit', lang)}</th>
                      <th className="text-right p-3 font-medium text-xs">{t('cl.credit', lang)}</th>
                      <th className="text-right p-3 font-medium text-xs">{t('cl.balance', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground">
                          {t('cl.no_data', lang)}
                        </td>
                      </tr>
                    ) : data.entries.map((entry, idx) => (
                      <tr key={idx} className={cn('border-b', isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50')}>
                        <td className="p-3 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="p-3 text-xs text-muted-foreground">{fmtDateTime(entry.date)}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className={cn("text-xs", typeColor(entry.type))}>
                            {typeLabel(entry.type)}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-xs font-semibold">{entry.invoiceNo}</td>
                        <td className="p-3 text-muted-foreground text-xs">{entry.description}</td>
                        <td className={cn("p-3 text-right font-semibold", entry.debit > 0 ? "text-red-600" : "text-muted-foreground")}>
                          {entry.debit > 0 ? fmtNum(entry.debit) : '-'}
                        </td>
                        <td className={cn("p-3 text-right font-semibold", entry.credit > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                          {entry.credit > 0 ? fmtNum(entry.credit) : '-'}
                        </td>
                        <td className={cn("p-3 text-right font-bold", entry.balance >= 0 ? "text-red-600" : "text-emerald-600")}>
                          {fmtNum(entry.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer totals */}
                  {data.entries.length > 0 && (
                    <tfoot>
                      <tr className={cn('border-t-2 font-bold', isDark ? 'bg-slate-700/30' : 'bg-slate-100')}>
                        <td colSpan={5} className="p-3 text-sm">{t('cl.current_balance', lang)}</td>
                        <td className="p-3 text-right text-sm text-red-600">{fmtNum(data.summary.totalDebit)}</td>
                        <td className="p-3 text-right text-sm text-emerald-600">{fmtNum(data.summary.totalCredit)}</td>
                        <td className={cn("p-3 text-right text-sm", data.summary.currentBalance >= 0 ? "text-red-600" : "text-emerald-600")}>
                          {fmtNum(data.summary.currentBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}