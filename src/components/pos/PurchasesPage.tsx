'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Trash2, Truck, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Product { id: string; barcode: string; name: string; purchasePrice: number; stock: number; }
interface Party { id: string; name: string; phone?: string; balance: number; }

interface PurchaseItem {
  productId: string; productName: string; quantity: number; price: number; total: number;
}

export function PurchasesPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedParty, setSelectedParty] = useState<string>('');
  const [purchaseType, setPurchaseType] = useState('cash');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [search, setSearch] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetch('/api/party').then(r => r.json()).then(d => setParties(Array.isArray(d) ? d : []));
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
  }, []);

  const addToPurchase = (p: Product) => {
    const existing = items.find(i => i.productId === p.id);
    if (existing) {
      setItems(items.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i));
    } else {
      setItems([...items, { productId: p.id, productName: p.name, quantity: 1, price: p.purchasePrice, total: p.purchasePrice }]);
    }
  };

  const removeItem = (productId: string) => setItems(items.filter(i => i.productId !== productId));
  const updateQty = (productId: string, qty: number) => {
    setItems(items.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, qty), total: Math.max(1, qty) * i.price } : i));
  };
  const updatePrice = (productId: string, price: number) => {
    setItems(items.map(i => i.productId === productId ? { ...i, price, total: i.quantity * price } : i));
  };

  const subtotal = items.reduce((s, i) => s + i.total, 0);

  const handleSave = async () => {
    if (items.length === 0) { toast.error(t('purch.no_items', lang)); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: selectedParty || null, purchaseType, remarks,
          paid: purchaseType === 'cash' ? subtotal : 0,
          items: items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, price: i.price, total: i.total })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('purch.invoice_created', lang) + ` ${data.invoiceNo}`);
        setItems([]); setRemarks(''); setSearch('');
        fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
      } else { toast.error(data.error || t('sale.error', lang)); }
    } finally { setLoading(false); }
  };

  const filteredProducts = search
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
    : [];

  return (
    <div className="flex gap-4 h-[calc(100vh-5rem)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-2xl font-bold">{t('purch.title', lang)}</h2>
          <div className="flex items-center gap-2">
            <Select value={purchaseType} onValueChange={setPurchaseType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('purch.cash', lang)}</SelectItem>
                <SelectItem value="credit">{t('purch.credit', lang)}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t('purch.select_party', lang)} /></SelectTrigger>
              <SelectContent>
                {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasPermission('purchases') && (
              <Dialog>
                <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> {t('purch.new_party', lang)}</Button></DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>{t('purch.new_party', lang)}</DialogTitle></DialogHeader>
                  <NewPartyForm lang={lang} onSave={() => fetch('/api/party').then(r => r.json()).then(d => setParties(Array.isArray(d) ? d : []))} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder={t('purch.search', lang)} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => setShowProducts(!showProducts)}>
            <Truck className="h-4 w-4 mr-1" /> {t('sale.products', lang)}
          </Button>
        </div>

        {showProducts && (
          <Card className={cn("flex-1 mb-3", isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-2">
              <div className="max-h-48 overflow-y-auto space-y-1">
                {(search ? filteredProducts : products).slice(0, 30).map(p => (
                  <button
                    key={p.id}
                    className={cn("w-full flex items-center justify-between p-2 rounded text-left text-sm", isDark ? 'hover:bg-slate-700/50' : 'hover:bg-emerald-50')}
                    onClick={() => { addToPurchase(p); toast.success(`${p.name} ${t('purch.product_added', lang)}`); }}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{t('common.currency', lang)} {p.purchasePrice.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={cn("flex-1", isDark && 'bg-slate-800 border-slate-700')}>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t('purch.select_product', lang)}</p>
              ) : items.map(item => (
                <div key={item.productId} className={cn("flex items-center gap-2 p-3 text-sm", isDark && 'divide-slate-700')}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.productName}</p>
                  </div>
                  <Input type="number" value={item.quantity} onChange={e => updateQty(item.productId, +e.target.value)} className="w-16 h-8 text-center" />
                  <span>x</span>
                  <Input type="number" value={item.price} onChange={e => updatePrice(item.productId, +e.target.value)} className="w-24 h-8 text-right" />
                  <span className="w-24 text-right font-bold">{t('common.currency', lang)} {item.total.toLocaleString()}</span>
                  {hasPermission('purchases') && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItem(item.productId)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-64 flex-shrink-0">
        <Card className={cn("sticky top-4", isDark && 'bg-slate-800 border-slate-700')}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex justify-between text-sm"><span>{t('sale.subtotal', lang)}</span><span className="font-mono">{t('common.currency', lang)} {subtotal.toLocaleString()}</span></div>
            <div>
              <Label className="text-sm">{t('purch.remarks', lang)}</Label>
              <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={t('purch.remarks_placeholder', lang)} className="h-8 mt-1" />
            </div>
            {hasPermission('purchases') && (
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold" onClick={handleSave} disabled={loading || items.length === 0}>
                {loading ? t('purch.saving', lang) : `${t('purch.save', lang)} - ${t('common.currency', lang)} ${subtotal.toLocaleString()}`}
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => { setItems([]); toast.info(t('purch.cleared', lang)); }}>{t('purch.empty', lang)}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NewPartyForm({ lang, onSave }: { lang: 'en' | 'ur'; onSave: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setLoading(true);
    await fetch('/api/party', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address, openingBalance: 0 }),
    });
    setName(''); setPhone(''); setAddress('');
    setLoading(false); onSave();
  };

  return (
    <div className="space-y-3 py-2">
      <div><Label>{t('purch.party_name', lang)} *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
      <div><Label>{t('purch.phone', lang)}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
      <div><Label>{t('purch.address', lang)}</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={loading || !name}><Save className="h-4 w-4 mr-2" /> {t('purch.save_party', lang)}</Button>
    </div>
  );
}