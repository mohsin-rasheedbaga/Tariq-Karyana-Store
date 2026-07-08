'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ShoppingCart, Trash2, Plus, Search, CreditCard, X, UserCheck, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Product { id: string; barcode: string; name: string; salePrice: number; wholeSalePrice: number; stock: number; unit?: { name: string }; }
interface Customer { id: string; barcode: string; name: string; phone?: string; balance: number; }

interface CartItem {
  productId: string; productBarcode: string; productName: string;
  price: number; quantity: number; total: number; maxStock: number;
}

export function SalesPage() {
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

  // Auto-focus barcode input
  useEffect(() => {
    const timer = setTimeout(() => barcodeRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const addToCart = useCallback((product: Product, qty: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity + qty > product.stock) {
          toast.error(`اسٹاک میں صرف ${product.stock} موجود ہیں`);
          return prev;
        }
        return prev.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.price }
            : i
        );
      }
      const price = saleType === 'wholeSale' ? product.wholeSalePrice : product.salePrice;
      return [...prev, {
        productId: product.id, productBarcode: product.barcode, productName: product.name,
        price, quantity: qty, total: price * qty, maxStock: product.stock,
      }];
    });
  }, [saleType]);

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;

    // Check if it's a customer barcode (starts with C)
    if (barcode.trim().startsWith('C')) {
      const customer = customers.find(c => c.barcode === barcode.trim());
      if (customer) {
        setSelectedCustomer(customer);
        toast.success(`کسٹمر: ${customer.name}`);
        setCustomerBarcode('');
        customerBarcodeRef.current?.focus();
        return;
      }
      // Try fetching
      const res = await fetch(`/api/customers?search=${barcode.trim()}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSelectedCustomer(data[0]);
        toast.success(`کسٹمر: ${data[0].name}`);
      }
      setCustomerBarcode('');
      return;
    }

    // Product barcode scan
    const product = products.find(p => p.barcode === barcode.trim());
    if (product) {
      addToCart(product);
      toast.success(`${product.name} ایڈ ہوا`);
    } else {
      // Try API search
      const res = await fetch(`/api/products?search=${barcode.trim()}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        addToCart(data[0]);
        toast.success(`${data[0].name} ایڈ ہوا`);
      } else {
        toast.error('پراڈکٹ نہیں ملا');
      }
    }
    setBarcodeInput('');
    barcodeRef.current?.focus();
  }, [products, customers, addToCart]);

  const handleBarcodeKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBarcodeScan(barcodeInput);
    }
  };

  const handleCustomerBarcodeKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBarcodeScan(customerBarcode);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.maxStock) { toast.error('اسٹاک سے زیادہ نہیں'); return i; }
      return { ...i, quantity: newQty, total: newQty * i.price };
    }));
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal - discount;

  const handleSave = async () => {
    if (cart.length === 0) { toast.error('کارٹ خالی ہے'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || null,
          saleType,
          discountAmount: discount,
          saleManName: saleMan,
          paid: saleType === 'cash' ? total : 0,
          items: cart.map(i => ({
            productId: i.productId, productName: i.productName,
            quantity: i.quantity, price: i.price, total: i.total,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`انوائس ${data.invoiceNo} بن گیا!`);
        setCart([]); setSelectedCustomer(null); setDiscount(0);
        setBarcodeInput('');
        // Reload products for updated stock
        fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
        fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : []));
        barcodeRef.current?.focus();
      } else {
        toast.error(data.error || 'خرابی');
      }
    } finally { setLoading(false); }
  };

  const filteredProducts = productSearch
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode.includes(productSearch))
    : [];

  return (
    <div className="flex gap-4 h-[calc(100vh-5rem)]">
      {/* Left: Product Selection */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-2xl font-bold">نیا سیل</h2>
          <div className="flex items-center gap-2">
            <Select value={saleType} onValueChange={setSaleType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">کیش سیل</SelectItem>
                <SelectItem value="credit">کریڈٹ سیل</SelectItem>
                <SelectItem value="wholeSale">تھوک سیل</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowProducts(!showProducts)}>
              <Search className="h-4 w-4 mr-1" /> پراڈکٹس
            </Button>
          </div>
        </div>

        {/* Customer Barcode Scan */}
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              <Input
                ref={customerBarcodeRef}
                placeholder="کسٹمر کارڈ بارکوڈ سکین کریں..."
                value={customerBarcode}
                onChange={e => setCustomerBarcode(e.target.value)}
                onKeyDown={handleCustomerBarcodeKey}
                className="font-mono"
              />
              {selectedCustomer ? (
                <Badge className="bg-emerald-100 text-emerald-800 gap-1 py-1 px-3">
                  {selectedCustomer.name}
                  <button onClick={() => setSelectedCustomer(null)}><X className="h-3 w-3" /></button>
                </Badge>
              ) : (
                <Select onValueChange={v => { const c = customers.find(c => c.id === v); if (c) setSelectedCustomer(c); }}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="کسٹمر منتخب" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Barcode Scanner */}
        <Card className="mb-3 border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-3">
            <Input
              ref={barcodeRef}
              placeholder="📱 بارکوڈ سکین کریں یا پراڈکٹ کوڈ ٹائپ کریں..."
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeKey}
              className="font-mono text-lg h-12 border-emerald-300"
            />
          </CardContent>
        </Card>

        {/* Product Search Results */}
        {showProducts && (
          <Card className="flex-1 mb-3">
            <CardContent className="p-3">
              <Input
                placeholder="پراڈکٹ سیرچ..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-[calc(100%-3rem)]">
                <div className="space-y-1">
                  {(productSearch ? filteredProducts : products).slice(0, 50).map(p => (
                    <button
                      key={p.id}
                      className="w-full flex items-center justify-between p-2 hover:bg-emerald-50 rounded-lg text-left text-sm transition-colors"
                      onClick={() => { addToCart(p); toast.success(`${p.name} ایڈ ہوا`); }}
                    >
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.barcode}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">Rs {p.salePrice.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">اسٹاک: {p.stock}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Cart Items */}
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5" />
              کارٹ ({cart.length} آئٹمز)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-22rem)]">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">بارکوڈ سکین کریں یا پراڈکٹ منتخب کریں</p>
              ) : (
                <div className="divide-y">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">Rs {item.price.toLocaleString()} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-mono font-bold">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="w-24 text-right font-bold text-sm">Rs {item.total.toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItem(item.productId)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right: Summary */}
      <div className="w-72 flex-shrink-0">
        <Card className="sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">بِل خلاصہ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedCustomer && (
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">کسٹمر</p>
                <p className="font-bold">{selectedCustomer.name}</p>
                <p className="text-xs">بیلنس: <span className="text-red-600 font-bold">Rs {selectedCustomer.balance.toLocaleString()}</span></p>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>سب ٹوٹل</span>
              <span className="font-mono">Rs {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">ڈسکاؤنٹ</Label>
              <Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} className="h-8 text-right" />
            </div>
            <Separator />
            <div className="flex justify-between text-xl font-bold">
              <span>ٹوٹل</span>
              <span className="text-emerald-600">Rs {total.toLocaleString()}</span>
            </div>
            {selectedCustomer && (
              <div className="text-xs text-slate-500">
                بیلنس بنے گا: <span className="font-bold text-red-600">Rs {(selectedCustomer.balance + total).toLocaleString()}</span>
              </div>
            )}
            <div>
              <Label className="text-sm">سیلز مین</Label>
              <Input value={saleMan} onChange={e => setSaleMan(e.target.value)} placeholder="نام" className="h-8 mt-1" />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
              onClick={handleSave}
              disabled={loading || cart.length === 0}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {loading ? 'محفوظ ہو رہا ہے...' : `سیو - Rs ${total.toLocaleString()}`}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { setCart([]); setDiscount(0); toast.info('کارٹ خالی'); }}>
              <Trash2 className="h-4 w-4 mr-2" /> کارٹ خالی
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={`text-sm font-medium ${className || ''}`}>{children}</label>;
}