'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Search, ArrowLeft, Save, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface OriginalSale {
  id: string;
  invoiceNo: string;
  customerId?: string;
  saleType: string;
  subtotal: number;
  total: number;
  customer?: { id: string; name: string; balance: number };
  items: SaleItem[];
}

interface ReturnItem {
  productId: string;
  productName: string;
  originalQty: number;
  returnQty: number;
  price: number;
}

interface SaleReturn {
  id: string;
  returnNo: string;
  customerId?: string;
  originalInvoiceNo?: string;
  subtotal: number;
  total: number;
  createdAt: string;
  customer?: { id: string; name: string };
  items: { id: string; productName: string; quantity: number; price: number; total: number }[];
}

export function SaleReturnsPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const currency = t('common.currency', lang);
  const locale = lang === 'ur' ? 'ur-PK' : 'en-US';

  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<'search' | 'items'>('search');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [searchingSale, setSearchingSale] = useState(false);
  const [originalSale, setOriginalSale] = useState<OriginalSale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/sale-returns${query}`);
      const data = await res.json();
      setReturns(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadReturns(); }, [startDate, endDate]);

  const handleSearchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    setSearchingSale(true);
    try {
      const res = await fetch(`/api/sale-returns?invoiceNo=${encodeURIComponent(invoiceSearch.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Sale not found');
        return;
      }
      const sale: OriginalSale = await res.json();
      setOriginalSale(sale);
      // Initialize return items with zero quantities
      setReturnItems(
        sale.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          originalQty: item.quantity,
          returnQty: 0,
          price: item.price,
        }))
      );
      setDialogStep('items');
    } catch {
      toast.error('Failed to search invoice');
    } finally {
      setSearchingSale(false);
    }
  };

  const handleInvoiceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchInvoice();
  };

  const updateReturnQty = (productId: string, qty: number) => {
    setReturnItems(prev =>
      prev.map(item => {
        if (item.productId !== productId) return item;
        const clampedQty = Math.max(0, Math.min(qty, item.originalQty));
        return { ...item, returnQty: clampedQty };
      })
    );
  };

  const handleReturnAll = () => {
    setReturnItems(prev =>
      prev.map(item => ({ ...item, returnQty: item.originalQty }))
    );
  };

  const returnTotal = returnItems.reduce((sum, item) => sum + item.returnQty * item.price, 0);
  const hasItemsToReturn = returnItems.some(item => item.returnQty > 0);

  const handleSubmitReturn = async () => {
    if (!originalSale || !hasItemsToReturn) return;
    setSubmitting(true);
    try {
      const itemsToReturn = returnItems
        .filter(item => item.returnQty > 0)
        .map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.returnQty,
          price: item.price,
        }));

      const res = await fetch('/api/sale-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalInvoiceNo: originalSale.invoiceNo,
          items: itemsToReturn,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${t('sr.new', lang)} ${data.returnNo} — ${currency} ${data.total.toLocaleString(locale)}`);
        resetDialog();
        void loadReturns();
      } else {
        toast.error(data.error || 'Failed to create return');
      }
    } catch {
      toast.error('Failed to create return');
    } finally {
      setSubmitting(false);
    }
  };

  const resetDialog = () => {
    setDialogStep('search');
    setInvoiceSearch('');
    setOriginalSale(null);
    setReturnItems([]);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetDialog();
  };

  const totalReturned = returns.reduce((sum, r) => sum + r.total, 0);

  if (!hasPermission('sales')) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Access Denied</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('sr.title', lang)}</h2>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <Button className="bg-orange-600 hover:bg-orange-700">
            <RotateCcw className="h-4 w-4 mr-1" /> {t('sr.new', lang)}
          </Button>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {dialogStep === 'search'
                  ? t('sr.new', lang)
                  : `${t('sr.new', lang)} — ${originalSale?.invoiceNo}`}
              </DialogTitle>
            </DialogHeader>

            {dialogStep === 'search' && (
              <div className="space-y-3 py-2">
                <div>
                  <Label>{t('sr.original_invoice', lang)} *</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder={t('sr.search_invoice', lang)}
                      value={invoiceSearch}
                      onChange={e => setInvoiceSearch(e.target.value)}
                      onKeyDown={handleInvoiceKeyDown}
                      className={cn('font-mono', isDark && 'bg-slate-800 border-slate-600')}
                    />
                    <Button
                      onClick={handleSearchInvoice}
                      disabled={searchingSale || !invoiceSearch.trim()}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {searchingSale ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {dialogStep === 'items' && originalSale && (
              <div className="space-y-3 py-2">
                {/* Sale Info */}
                <Card className={cn(isDark ? 'bg-slate-800 border-slate-700' : 'bg-orange-50/50 border-orange-200')}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('sr.original_invoice', lang)}</p>
                        <p className="font-bold font-mono">{originalSale.invoiceNo}</p>
                      </div>
                      {originalSale.customer && (
                        <div>
                          <p className="text-sm text-muted-foreground">Customer</p>
                          <p className="font-bold">{originalSale.customer.name}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-bold">{currency} {originalSale.total.toLocaleString(locale)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Items Table */}
                <div className="text-sm font-medium flex items-center justify-between">
                  <span>Items</span>
                  <Button variant="outline" size="sm" onClick={handleReturnAll}>
                    {t('sr.return_all', lang)}
                  </Button>
                </div>
                <ScrollArea className="max-h-64">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={cn('border-b', isDark ? 'border-slate-600' : 'border-slate-200')}>
                        <th className="text-left p-2">{lang === 'ur' ? 'مصنوعات' : 'Product'}</th>
                        <th className="text-center p-2">{lang === 'ur' ? 'اصل مقدار' : 'Sold'}</th>
                        <th className="text-center p-2">{t('sr.return_qty', lang)}</th>
                        <th className="text-right p-2">{lang === 'ur' ? 'قیمت' : 'Price'}</th>
                        <th className="text-right p-2">{lang === 'ur' ? 'کل' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map(item => (
                        <tr key={item.productId} className={cn('border-b', isDark ? 'border-slate-700' : 'border-slate-100')}>
                          <td className="p-2 font-medium">{item.productName}</td>
                          <td className="p-2 text-center text-muted-foreground">{item.originalQty}</td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              max={item.originalQty}
                              value={item.returnQty || ''}
                              onChange={e => updateReturnQty(item.productId, +e.target.value)}
                              placeholder="0"
                              className="h-8 w-20 text-center font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono">{currency} {item.price.toLocaleString(locale)}</td>
                          <td className="p-2 text-right font-bold font-mono">
                            {currency} {(item.returnQty * item.price).toLocaleString(locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>

                <Separator />

                {/* Return Total */}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{lang === 'ur' ? 'واپسی کل' : 'Return Total'}</span>
                  <span className="text-xl font-bold text-orange-600">{currency} {returnTotal.toLocaleString(locale)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDialogStep('search')}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> {lang === 'ur' ? 'واپس' : 'Back'}
                  </Button>
                  <Button
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    onClick={handleSubmitReturn}
                    disabled={submitting || !hasItemsToReturn}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    {submitting
                      ? (lang === 'ur' ? 'محفوظ ہو رہا ہے...' : 'Saving...')
                      : `${t('sr.new', lang)} — ${currency} ${returnTotal.toLocaleString(locale)}`}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Date Filter + Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
          <CardContent className="p-3 flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm whitespace-nowrap">{lang === 'ur' ? 'شروع' : 'From'}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={cn('h-8 w-40', isDark && 'bg-slate-700 border-slate-600')}
            />
            <Label className="text-sm whitespace-nowrap">{lang === 'ur' ? 'اختتام' : 'To'}</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={cn('h-8 w-40', isDark && 'bg-slate-700 border-slate-600')}
            />
          </CardContent>
        </Card>
        <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-orange-900/40 text-orange-400' : 'bg-orange-50 text-orange-600')}>
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{lang === 'ur' ? 'کل واپسی' : 'Total Returns'}</p>
              <p className="text-xl font-bold text-orange-600">{currency} {totalReturned.toLocaleString(locale)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Returns Table */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('border-b', isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50')}>
                    <th className="text-left p-3">{t('sr.return_no', lang)}</th>
                    <th className="text-left p-3">{t('sr.original_invoice', lang)}</th>
                    <th className="text-left p-3">{lang === 'ur' ? 'گاہک' : 'Customer'}</th>
                    <th className="text-right p-3">{lang === 'ur' ? 'واپسی کل' : 'Return Total'}</th>
                    <th className="text-left p-3">{lang === 'ur' ? 'تاریخ' : 'Date'}</th>
                    <th className="text-center p-3">{lang === 'ur' ? 'آئٹمز' : 'Items'}</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('sr.no_returns', lang)}
                      </td>
                    </tr>
                  ) : (
                    returns.map(r => (
                      <tr
                        key={r.id}
                        className={cn(
                          'border-b transition-colors',
                          isDark ? 'border-slate-700 hover:bg-slate-700/60' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="p-3">
                          <Badge className={cn('font-mono', isDark ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-700')}>
                            {r.returnNo}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">{r.originalInvoiceNo || '-'}</td>
                        <td className="p-3">{r.customer?.name || '-'}</td>
                        <td className="p-3 text-right font-bold text-orange-600">
                          {currency} {r.total.toLocaleString(locale)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {r.items.length}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}