'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Search, X, Edit2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface StockItem {
  id: string; barcode: string; name: string; stock: number; minStock: number;
  purchasePrice: number; salePrice: number; group?: { name: string };
}

export function StockPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';

  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjProduct, setAdjProduct] = useState<StockItem | null>(null);
  const [newStock, setNewStock] = useState(0);
  const [reason, setReason] = useState('');

  const canAdjust = hasPermission('stock');

  const loadData = async () => {
    const res = await fetch('/api/stock');
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => { void loadData(); }, []);

  const handleAdjust = async () => {
    if (!adjProduct) return;
    await fetch('/api/stock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: adjProduct.id, newStock, reason }),
    });
    toast.success(`${adjProduct.name} ${t('stock.stock_updated', lang)}`);
    setAdjOpen(false); loadData();
  };

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.barcode.includes(search))
    : items;

  const totalValue = items.reduce((sum, i) => sum + (i.stock * i.purchasePrice), 0);
  const lowCount = items.filter(i => i.stock <= i.minStock).length;
  const currency = t('common.currency', lang);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('stock.title', lang)}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={isDark ? 'bg-slate-800 border-slate-700' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('stock.total_items', lang)}</p>
              <p className="text-xl font-bold">{items.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={isDark ? 'bg-slate-800 border-slate-700' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('stock.low_stock', lang)}</p>
              <p className="text-xl font-bold text-amber-600">{lowCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={isDark ? 'bg-slate-800 border-slate-700' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('stock.total_value', lang)}</p>
              <p className="text-xl font-bold">{currency} {totalValue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder={t('stock.search', lang)}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearch('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <Card className={isDark ? 'bg-slate-800 border-slate-700' : ''}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn(
                  'border-b',
                  isDark ? 'bg-slate-700/50' : 'bg-slate-50'
                )}>
                  <th className="text-left p-3 font-medium">Barcode</th>
                  <th className="text-left p-3 font-medium">{t('products.name', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('stock.title', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('purchase.price', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('stock.total_value', lang)}</th>
                  <th className="text-center p-3 font-medium">{t('stock.status', lang)}</th>
                  {canAdjust && (
                    <th className="text-center p-3 font-medium">{t('products.actions', lang)}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className={cn(
                    'border-b',
                    isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'
                  )}>
                    <td className="p-3 font-mono text-xs">{item.barcode}</td>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-right font-bold">{item.stock}</td>
                    <td className="p-3 text-right">{currency} {item.purchasePrice.toLocaleString()}</td>
                    <td className="p-3 text-right">{currency} {(item.stock * item.purchasePrice).toLocaleString()}</td>
                    <td className="p-3 text-center">
                      {item.stock <= item.minStock ? (
                        <Badge variant="destructive">{t('stock.low', lang)}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                          {t('stock.ok', lang)}
                        </Badge>
                      )}
                    </td>
                    {canAdjust && (
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAdjProduct(item);
                            setNewStock(item.stock);
                            setReason('');
                            setAdjOpen(true);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> {t('stock.adjust', lang)}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canAdjust && (
        <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('stock.adj_title', lang)}</DialogTitle>
            </DialogHeader>
            {adjProduct && (
              <div className="space-y-3">
                <p className="font-medium">{adjProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t('stock.current', lang)}: <span className="font-bold">{adjProduct.stock}</span>
                </p>
                <div>
                  <Label>{t('stock.new_stock', lang)}</Label>
                  <Input type="number" value={newStock} onChange={e => setNewStock(+e.target.value)} />
                </div>
                <div>
                  <Label>{t('stock.reason', lang)}</Label>
                  <Input
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={t('stock.reason_placeholder', lang)}
                  />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleAdjust}
                >
                  {t('stock.update', lang)}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}