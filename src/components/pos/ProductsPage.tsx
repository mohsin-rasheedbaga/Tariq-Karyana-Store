'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Barcode, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Product {
  id: string; barcode: string; name: string; subCategoryId?: string;
  groupId?: string; unitId?: string; purchasePrice: number; salePrice: number;
  wholeSalePrice: number; stock: number; minStock: number; isActive: boolean;
  subCategory?: { id: string; name: string };
  group?: { id: string; name: string };
  unit?: { id: string; name: string };
}
interface Category { id: string; name: string; }
interface Group { id: string; name: string; }
interface Unit { id: string; name: string; }

const emptyProduct = {
  barcode: '', name: '', subCategoryId: '', groupId: '', unitId: '',
  purchasePrice: 0, salePrice: 0, wholeSalePrice: 0, stock: 0, minStock: 0,
};

export function ProductsPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [loading, setLoading] = useState(false);
  const barcodeRef = useRef<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const loadData = useCallback(async () => {
    const [pRes, cRes, gRes, uRes] = await Promise.all([
      fetch('/api/products' + (search ? `?search=${search}` : '')).then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/groups').then(r => r.json()),
      fetch('/api/units').then(r => r.json()),
    ]);
    setProducts(Array.isArray(pRes) ? pRes : []);
    setCategories(Array.isArray(cRes) ? cRes : []);
    setGroups(Array.isArray(gRes) ? gRes : []);
    setUnits(Array.isArray(uRes) ? uRes : []);
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editing) {
        await fetch(`/api/products/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      } else {
        await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      }
      setOpen(false); setEditing(null); setForm(emptyProduct); loadData();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('prod.disable', lang))) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    loadData();
  };

  const handleEdit = (p: Product) => {
    setEditing(p);
    setForm({ barcode: p.barcode, name: p.name, subCategoryId: p.subCategoryId || '', groupId: p.groupId || '', unitId: p.unitId || '', purchasePrice: p.purchasePrice, salePrice: p.salePrice, wholeSalePrice: p.wholeSalePrice, stock: p.stock, minStock: p.minStock });
    setOpen(true);
  };

  const generateAndShowBarcode = () => {
    if (editing?.barcode && barcodeRef.current) {
      import('jsbarcode').then(JsBarcode => { JsBarcode.default(barcodeRef.current, editing.barcode, { format: 'CODE128', width: 2, height: 50, displayValue: true, fontSize: 14 }); });
    }
  };

  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('prod.title', lang)}</h2>
        {hasPermission('products') && (
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyProduct); }}}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" /> {t('prod.new', lang)}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? t('prod.edit', lang) : t('prod.new', lang)}</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>{t('prod.barcode', lang)}</Label>
                  <div className="flex gap-2">
                    <Input value={form.barcode} onChange={e => update('barcode', e.target.value)} placeholder={t('prod.auto_barcode', lang)} className="font-mono" />
                    {editing && <Button variant="outline" size="icon" onClick={generateAndShowBarcode}><Barcode className="h-4 w-4" /></Button>}
                  </div>
                  {editing && <svg ref={barcodeRef} className="mt-2 mx-auto" />}
                </div>
                <div><Label>{t('prod.name', lang)} *</Label><Input value={form.name} onChange={e => update('name', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t('prod.purchase_price', lang)}</Label><Input type="number" value={form.purchasePrice} onChange={e => update('purchasePrice', +e.target.value)} /></div>
                  <div><Label>{t('prod.sale_price', lang)}</Label><Input type="number" value={form.salePrice} onChange={e => update('salePrice', +e.target.value)} /></div>
                  <div><Label>{t('prod.wholesale_price', lang)}</Label><Input type="number" value={form.wholeSalePrice} onChange={e => update('wholeSalePrice', +e.target.value)} /></div>
                  <div><Label>{t('prod.stock', lang)}</Label><Input type="number" value={form.stock} onChange={e => update('stock', +e.target.value)} /></div>
                  <div><Label>{t('prod.min_stock', lang)}</Label><Input type="number" value={form.minStock} onChange={e => update('minStock', +e.target.value)} /></div>
                  <div>
                    <Label>{t('prod.unit', lang)}</Label>
                    <Select value={form.unitId} onValueChange={v => update('unitId', v)}>
                      <SelectTrigger><SelectValue placeholder={t('prod.select_unit', lang)} /></SelectTrigger>
                      <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('prod.group', lang)}</Label>
                    <Select value={form.groupId} onValueChange={v => update('groupId', v)}>
                      <SelectTrigger><SelectValue placeholder={t('prod.select_group', lang)} /></SelectTrigger>
                      <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('prod.category', lang)}</Label>
                    <Select value={form.subCategoryId} onValueChange={v => update('subCategoryId', v)}>
                      <SelectTrigger><SelectValue placeholder={t('prod.select_category', lang)} /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700 w-full mt-2" onClick={handleSave} disabled={loading || !form.name}>
                  <Save className="h-4 w-4 mr-2" /> {editing ? t('prod.update', lang) : t('prod.save', lang)}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder={t('prod.search', lang)} value={search} onChange={e => setSearch(e.target.value)} />
        {search && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch('')}><X className="h-3 w-3" /></Button>}
      </div>

      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn("border-b", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
                  <th className="text-left p-3 font-medium">{t('prod.barcode', lang)}</th>
                  <th className="text-left p-3 font-medium">{t('prod.name', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('prod.purchase_price', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('prod.sale_price', lang)}</th>
                  <th className="text-right p-3 font-medium">{t('prod.stock', lang)}</th>
                  <th className="text-left p-3 font-medium">{t('prod.group', lang)}</th>
                  <th className="text-center p-3 font-medium">{t('prod.operations', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">{t('prod.no_products', lang)}</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} className={cn("border-b", isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50')}>
                    <td className="p-3 font-mono text-xs">{p.barcode}</td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-right">{t('common.currency', lang)} {p.purchasePrice.toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold text-emerald-600">{t('common.currency', lang)} {p.salePrice.toLocaleString()}</td>
                    <td className="p-3 text-right"><span className={p.stock <= p.minStock ? 'text-red-600 font-bold' : ''}>{p.stock}</span></td>
                    <td className="p-3"><Badge variant="secondary">{p.group?.name || '-'}</Badge></td>
                    <td className="p-3 text-center">
                      {hasPermission('products') && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}><Edit2 className="h-3.5 w-3.5" /></Button>}
                      {hasPermission('products') && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}