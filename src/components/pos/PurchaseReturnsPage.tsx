'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, Search, ArrowLeftRight, CalendarDays, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PurchaseReturnItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  maxQty?: number; // for editing - max returnable qty
}

interface PurchaseReturn {
  id: string;
  returnNo: string;
  partyId?: string;
  originalInvoiceNo?: string;
  subtotal: number;
  total: number;
  createdAt: string;
  party?: { id: string; name: string } | null;
  items: PurchaseReturnItem[];
}

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  product?: { id: string; stock: number };
}

interface Purchase {
  id: string;
  invoiceNo: string;
  partyId?: string;
  party?: { id: string; name: string } | null;
  purchaseType: string;
  total: number;
  createdAt: string;
  items: PurchaseItem[];
}

export function PurchaseReturnsPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New return dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [searchedPurchase, setSearchedPurchase] = useState<Purchase | null>(null);
  const [searching, setSearching] = useState(false);
  const [returnItems, setReturnItems] = useState<PurchaseReturnItem[]>([]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/purchase-returns?${params.toString()}`);
      const data = await res.json();
      setReturns(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t('pr.fetch_error', lang) || 'Failed to fetch returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [startDate, endDate]);

  // Search for a purchase invoice
  const handleSearchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    setSearching(true);
    setSearchedPurchase(null);
    setReturnItems([]);
    try {
      const res = await fetch('/api/purchases');
      const allPurchases: Purchase[] = await res.json();
      const match = allPurchases.find(
        (p) => p.invoiceNo.toLowerCase() === invoiceSearch.trim().toLowerCase()
      );
      if (match) {
        setSearchedPurchase(match);
        // Initialize return items with 0 qty
        setReturnItems(
          match.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: 0,
            price: item.price,
            total: 0,
            maxQty: item.quantity,
          }))
        );
      } else {
        toast.error(t('pr.invoice_not_found', lang) || 'Invoice not found');
      }
    } catch {
      toast.error(t('pr.search_error', lang) || 'Error searching invoice');
    } finally {
      setSearching(false);
    }
  };

  // Update a return item's quantity
  const updateReturnQty = (productId: string, qty: number) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const clampedQty = Math.max(0, Math.min(qty, item.maxQty || qty));
        return {
          ...item,
          quantity: clampedQty,
          total: clampedQty * item.price,
        };
      })
    );
  };

  // Set all items to max returnable quantity
  const returnAll = () => {
    setReturnItems((prev) =>
      prev.map((item) => ({
        ...item,
        quantity: item.maxQty || 0,
        total: (item.maxQty || 0) * item.price,
      }))
    );
  };

  // Clear all return quantities
  const clearAll = () => {
    setReturnItems((prev) =>
      prev.map((item) => ({
        ...item,
        quantity: 0,
        total: 0,
      }))
    );
  };

  const returnTotal = returnItems.reduce((sum, item) => sum + item.total, 0);
  const hasItemsToReturn = returnItems.some((item) => item.quantity > 0);

  // Submit the return
  const handleSubmitReturn = async () => {
    if (!searchedPurchase) return;
    if (!hasItemsToReturn) {
      toast.error(t('pr.no_items', lang) || 'No items to return');
      return;
    }

    setSubmitting(true);
    try {
      const itemsToReturn = returnItems.filter((item) => item.quantity > 0);
      const res = await fetch('/api/purchase-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: searchedPurchase.partyId || null,
          originalInvoiceNo: searchedPurchase.invoiceNo,
          items: itemsToReturn.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${t('pr.created', lang) || 'Return created'} - ${data.returnNo}`);
        setDialogOpen(false);
        setSearchedPurchase(null);
        setReturnItems([]);
        setInvoiceSearch('');
        fetchReturns();
      } else {
        toast.error(data.error || t('pr.error', lang) || 'Failed to create return');
      }
    } catch {
      toast.error(t('pr.error', lang) || 'Failed to create return');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!hasPermission('purchases')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isDark ? 'bg-orange-900/30' : 'bg-orange-100'
          )}>
            <RotateCcw className="h-5 w-5 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold">{t('pr.title', lang)}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date filters */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn("w-36 h-9 text-sm", isDark && 'bg-slate-800 border-slate-700')}
            />
            <span className="text-muted-foreground text-sm">—</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={cn("w-36 h-9 text-sm", isDark && 'bg-slate-800 border-slate-700')}
            />
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="h-9 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {t('common.close', lang)}
              </Button>
            )}
          </div>

          {/* New Return Button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700 gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                {t('pr.new', lang)}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-orange-600" />
                  {t('pr.new', lang)}
                </DialogTitle>
                <DialogDescription>
                  {t('pr.new_desc', lang)}
                </DialogDescription>
              </DialogHeader>

              {/* Invoice Search */}
              <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      placeholder={t('pr.search_invoice', lang)}
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchInvoice()}
                    />
                  </div>
                  <Button
                    onClick={handleSearchInvoice}
                    disabled={searching || !invoiceSearch.trim()}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {searching ? '...' : t('common.search', lang)}
                  </Button>
                </div>

                {/* Searched Purchase Info */}
                {searchedPurchase && (
                  <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-orange-600" />
                          <span className="font-bold">{searchedPurchase.invoiceNo}</span>
                          {searchedPurchase.party && (
                            <Badge variant="outline" className="text-xs">
                              {searchedPurchase.party.name}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {t('common.currency', lang)} {searchedPurchase.total.toLocaleString()}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={returnAll}>
                            {t('pr.return_all', lang)}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearAll}>
                            {t('pr.clear_all', lang)}
                          </Button>
                        </div>
                      </div>

                      {/* Items Table */}
                      <ScrollArea className="max-h-64">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('pr.product', lang)}</TableHead>
                              <TableHead className="text-center">{t('pr.purchased_qty', lang)}</TableHead>
                              <TableHead className="text-center">{t('pr.return_qty', lang)}</TableHead>
                              <TableHead className="text-right">{t('pr.price', lang)}</TableHead>
                              <TableHead className="text-right">{t('pr.total', lang)}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returnItems.map((item) => (
                              <TableRow key={item.productId}>
                                <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                                <TableCell className="text-center text-sm text-muted-foreground">
                                  {item.maxQty}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={item.maxQty}
                                    value={item.quantity}
                                    onChange={(e) => updateReturnQty(item.productId, +e.target.value)}
                                    className="w-20 h-8 text-center mx-auto"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {t('common.currency', lang)} {item.price.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-sm font-mono font-bold">
                                  {t('common.currency', lang)} {item.total.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>

                      {/* Total */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <Label className="text-sm font-bold">{t('pr.return_total', lang)}</Label>
                        <span className="text-lg font-bold text-orange-600">
                          {t('common.currency', lang)} {returnTotal.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter className="pt-3 border-t">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel', lang)}
                </Button>
                <Button
                  onClick={handleSubmitReturn}
                  disabled={submitting || !hasItemsToReturn}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {submitting
                    ? (t('pr.submitting', lang) || 'Saving...')
                    : `${t('pr.submit', lang)} - ${t('common.currency', lang)} ${returnTotal.toLocaleString()}`
                  }
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Returns Table */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <RotateCcw className="h-12 w-12 mb-3 opacity-30" />
              <p>{t('pr.no_returns', lang)}</p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">{t('pr.return_no', lang)}</TableHead>
                    <TableHead className="font-bold">{t('pr.party', lang)}</TableHead>
                    <TableHead className="font-bold">{t('pr.original_invoice', lang)}</TableHead>
                    <TableHead className="font-bold text-right">{t('pr.total', lang)}</TableHead>
                    <TableHead className="font-bold text-right">{t('pr.items_count', lang)}</TableHead>
                    <TableHead className="font-bold text-right">{t('pr.date', lang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((ret) => (
                    <TableRow key={ret.id} className={cn(isDark && 'border-slate-700')}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-orange-600 border-orange-300">
                          {ret.returnNo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ret.party?.name || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {ret.originalInvoiceNo || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        {t('common.currency', lang)} {ret.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {ret.items.length}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(ret.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}