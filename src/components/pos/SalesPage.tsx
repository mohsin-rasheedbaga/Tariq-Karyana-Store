'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ShoppingCart, Trash2, Plus, Search, CreditCard, X, UserCheck, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Product { id: string; barcode: string; name: string; salePrice: number; wholeSalePrice: number; stock: number; unit?: { name: string }; }
interface Customer { id: string; barcode: string; name: string; phone?: string; balance: number; cardType?: string; accountNo?: string; }

interface CartItem {
  productId: string; productBarcode: string; productName: string;
  price: number; quantity: number; total: number; maxStock: number;
}

export function SalesPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const [barcodeInput, setBarcodeInput] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerBarcode, setCustomerBarcode] = useState('');
  const [saleType, setSaleType] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [saleMan, setSaleMan] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const [loading, setLoading] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const customerBarcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : []));
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { const timer = setTimeout(() => barcodeRef.current?.focus(), 100); return () => clearTimeout(timer); }, []);

  const addToCart = useCallback((product: Product, qty: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity + qty > product.stock) { toast.error(`${t('sale.stock_only', lang)} ${product.stock}`); return prev; }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.price } : i);
      }
      const price = saleType === 'wholeSale' ? product.wholeSalePrice : product.salePrice;
      return [...prev, { productId: product.id, productBarcode: product.barcode, productName: product.name, price, quantity: qty, total: price * qty, maxStock: product.stock }];
    });
  }, [saleType, lang]);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;
    if (barcode.trim().startsWith('C')) {
      const customer = customers.find(c => c.barcode === barcode.trim());
      if (customer) {
        setSelectedCustomer(customer);
        // Auto-switch to wholesale if customer has wholesale card
        if (customer.cardType === 'wholesale') {
          setSaleType('wholeSale');
          toast.success(`${lang === 'ur' ? 'ہول سیلر' : 'Wholesale'}: ${customer.name}`, { description: lang === 'ur' ? 'ہول سیل ریٹ لاگو' : 'Wholesale rate applied' });
        } else {
          toast.success(`${t('sale.customer_selected', lang)} ${customer.name}`);
        }
        setCustomerBarcode(''); customerBarcodeRef.current?.focus(); return;
      }
      const res = await fetch(`/api/customers?search=${barcode.trim()}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSelectedCustomer(data[0]);
        if (data[0].cardType === 'wholesale') {
          setSaleType('wholeSale');
          toast.success(`${lang === 'ur' ? 'ہول سیلر' : 'Wholesale'}: ${data[0].name}`, { description: lang === 'ur' ? 'ہول سیل ریٹ لاگو' : 'Wholesale rate applied' });
        } else {
          toast.success(`${t('sale.customer_selected', lang)} ${data[0].name}`);
        }
      }
      setCustomerBarcode(''); return;
    }
    const product = products.find(p => p.barcode === barcode.trim());
    if (product) { addToCart(product); toast.success(`${product.name} ${t('sale.product_added', lang)}`); }
    else {
      const res = await fetch(`/api/products?search=${barcode.trim()}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) { addToCart(data[0]); toast.success(`${data[0].name} ${t('sale.product_added', lang)}`); }
      else { toast.error(t('sale.product_not_found', lang)); }
    }
    setBarcodeInput(''); barcodeRef.current?.focus();
  }, [products, customers, addToCart, lang]);

  const handleBarcodeKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleBarcodeScan(barcodeInput); };
  const handleCustomerBarcodeKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleBarcodeScan(customerBarcode); };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.maxStock) { toast.error(t('sale.more_than_stock', lang)); return i; }
      return { ...i, quantity: newQty, total: newQty * i.price };
    }));
  };
  const removeItem = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal - discount;

  const handleSave = async () => {
    if (cart.length === 0) { toast.error(t('sale.empty_cart', lang)); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomer?.id || null, saleType, discountAmount: discount, saleManName: saleMan, paid: saleType === 'cash' ? total : 0, items: cart.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, price: i.price, total: i.total })) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${t('sale.invoice_created', lang)} ${data.invoiceNo}`);
        setCart([]); setSelectedCustomer(null); setDiscount(0); setBarcodeInput('');
        fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
        fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : []));
        barcodeRef.current?.focus();
      } else { toast.error(data.error || t('sale.error', lang)); }
    } finally { setLoading(false); }
  };

  const filteredProducts = productSearch ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode.includes(productSearch)) : [];

  if (!hasPermission('sales')) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Access Denied</p></div>;
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-5rem)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-2xl font-bold">{t('sale.title', lang)}</h2>
          <div className="flex items-center gap-2">
            <Select value={saleType} onValueChange={setSaleType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('sale.cash', lang)}</SelectItem>
                <SelectItem value="credit">{t('sale.credit', lang)}</SelectItem>
                <SelectItem value="wholeSale">{t('sale.wholesale', lang)}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowProducts(!showProducts)}>
              <Search className="h-4 w-4 mr-1" /> {t('sale.products', lang)}
            </Button>
          </div>
        </div>

        <Card className={cn("mb-3", isDark && 'bg-slate-800 border-slate-700')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              <Input ref={customerBarcodeRef} placeholder={t('sale.customer_scan', lang)} value={customerBarcode} onChange={e => setCustomerBarcode(e.target.value)} onKeyDown={handleCustomerBarcodeKey} className="font-mono" />
              {selectedCustomer ? (
                <Badge className={cn("gap-1 py-1 px-3", selectedCustomer.cardType === 'wholesale' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>
                  {selectedCustomer.cardType === 'wholesale' ? 'WS' : 'REG'}
                  {selectedCustomer.name}<button onClick={() => { setSelectedCustomer(null); setSaleType('cash'); }}><X className="h-3 w-3" /></button>
                </Badge>
              ) : (
                <Select onValueChange={v => { const c = customers.find(c => c.id === v); if (c) setSelectedCustomer(c); }}>
                  <SelectTrigger className="w-40"><SelectValue placeholder={t('sale.select_customer', lang)} /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn("mb-3 border-emerald-200", isDark ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50/30')}>
          <CardContent className="p-3">
            <Input ref={barcodeRef} placeholder={t('sale.scan', lang)} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeKey} className="font-mono text-lg h-12 border-emerald-300" />
          </CardContent>
        </Card>

        {showProducts && (
          <Card className={cn("flex-1 mb-3", isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-3">
              <Input placeholder={t('sale.product_search', lang)} value={productSearch} onChange={e => setProductSearch(e.target.value)} className="mb-2" />
              <ScrollArea className="h-[calc(100%-3rem)]">
                <div className="space-y-1">
                  {(productSearch ? filteredProducts : products).slice(0, 50).map(p => (
                    <button key={p.id} className={cn("w-full flex items-center justify-between p-2 rounded-lg text-left text-sm transition-colors", isDark ? 'hover:bg-slate-700' : 'hover:bg-emerald-50')} onClick={() => { addToCart(p); toast.success(`${p.name} ${t('sale.product_added', lang)}`); }}>
                      <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground font-mono">{p.barcode}</p></div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">{t('common.currency', lang)} {p.salePrice.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{t('sale.stock_label', lang)}: {p.stock}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Card className={cn("flex-1", isDark && 'bg-slate-800 border-slate-700')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg"><ShoppingCart className="h-5 w-5" /> {t('sale.cart', lang)} ({cart.length} {t('sale.items', lang)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-22rem)]">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t('sale.scan_to_add', lang)}</p>
              ) : (
                <div className="divide-y">
                  {cart.map(item => (
                    <div key={item.productId} className={cn("flex items-center gap-3 p-3", isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50')}>
                      <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{item.productName}</p><p className="text-xs text-muted-foreground">{t('common.currency', lang)} {item.price.toLocaleString()} x {item.quantity}</p></div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-8 text-center font-mono font-bold">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                      <span className="w-24 text-right font-bold text-sm">{t('common.currency', lang)} {item.total.toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItem(item.productId)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="w-72 flex-shrink-0">
        <Card className={cn("sticky top-4", isDark && 'bg-slate-800 border-slate-700')}>
          <CardHeader className="pb-2"><CardTitle className="text-lg">{t('sale.bill_summary', lang)}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {selectedCustomer && (
              <div className={cn("rounded-lg p-2", isDark ? 'bg-emerald-900/20' : 'bg-emerald-50')}>
                <p className="text-xs text-muted-foreground">{t('sale.customer', lang)}</p>
                <p className="font-bold">{selectedCustomer.name}</p>
                <p className="text-xs">{t('cust.balance', lang)}: <span className="text-red-600 font-bold">{t('common.currency', lang)} {selectedCustomer.balance.toLocaleString()}</span></p>
              </div>
            )}
            <div className="flex justify-between text-sm"><span>{t('sale.subtotal', lang)}</span><span className="font-mono">{t('common.currency', lang)} {subtotal.toLocaleString()}</span></div>
            <div className="flex items-center gap-2"><label className="text-sm">{t('sale.discount', lang)}</label><Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} className="h-8 text-right" /></div>
            <Separator />
            <div className="flex justify-between text-xl font-bold"><span>{t('sale.total', lang)}</span><span className="text-emerald-600">{t('common.currency', lang)} {total.toLocaleString()}</span></div>
            {selectedCustomer && <div className="text-xs text-slate-500">{t('sale.balance_will', lang)}: <span className="font-bold text-red-600">{t('common.currency', lang)} {(selectedCustomer.balance + total).toLocaleString()}</span></div>}
            <div><label className="text-sm">{t('sale.salesman', lang)}</label><Input value={saleMan} onChange={e => setSaleMan(e.target.value)} placeholder={t('sale.name_placeholder', lang)} className="h-8 mt-1" /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold" onClick={handleSave} disabled={loading || cart.length === 0}>
              <CreditCard className="h-5 w-5 mr-2" />{loading ? t('sale.saving', lang) : `${t('sale.save', lang)} - ${t('common.currency', lang)} ${total.toLocaleString()}`}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { setCart([]); setDiscount(0); toast.info(t('sale.cart_cleared', lang)); }}><Trash2 className="h-4 w-4 mr-2" /> {t('sale.clear_cart', lang)}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}