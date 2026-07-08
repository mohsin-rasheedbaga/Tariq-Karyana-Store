'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, CreditCard, X, Save, Printer, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Customer {
  id: string; barcode: string; name: string; phone?: string; address?: string;
  comments?: string; openingBalance: number; balance: number; isActive: boolean;
  createdAt: string;
}

const emptyCustomer = { name: '', phone: '', address: '', comments: '', openingBalance: 0 };

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [loading, setLoading] = useState(false);
  const cardBarcodeRef = useRef<SVGSVGElement>(null);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/customers' + (search ? `?search=${search}` : ''));
    const data = await res.json();
    setCustomers(Array.isArray(data) ? data : []);
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!form.name) return;
    setLoading(true);
    try {
      if (editing) {
        await fetch(`/api/customers/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/customers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      setOpen(false); setEditing(null); setForm(emptyCustomer); loadData();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('کیا آپ یہ کسٹمر غیر فعال کرنا چاہتے ہیں؟')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    loadData();
  };

  const handleEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', comments: c.comments || '', openingBalance: c.openingBalance });
    setOpen(true);
  };

  const showCard = (c: Customer) => {
    setSelectedCustomer(c);
    setCardOpen(true);
    setTimeout(() => {
      if (cardBarcodeRef.current) {
        import('jsbarcode').then(JsBarcode => {
          JsBarcode.default(cardBarcodeRef.current, c.barcode, {
            format: 'CODE128', width: 2.5, height: 60, displayValue: true, fontSize: 16,
            margin: 5,
          });
        });
      }
    }, 100);
  };

  const printCard = () => {
    const cardEl = document.getElementById('customer-card-print');
    if (!cardEl) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Customer Card - ${selectedCustomer?.name}</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:Arial,sans-serif;}
      .card{width:350px;border:2px solid #000;border-radius:12px;padding:20px;text-align:center;}
      .card h2{margin:0 0 5px;font-size:18px;} .card p{margin:2px 0;font-size:13px;}
      .barcode-svg{margin:10px auto;}</style></head><body>`);
    w.document.write(cardEl.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">کسٹمرز اور کارڈ سسٹم</h2>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyCustomer); }}}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" /> نیا کسٹمر
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'کسٹمر ایڈٹ' : 'نیا کسٹمر'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>کسٹمر نام *</Label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="نام" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>فون نمبر</Label>
                  <Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="03XX-XXXXXXX" />
                </div>
                <div>
                  <Label>اوپننگ بیلنس</Label>
                  <Input type="number" value={form.openingBalance} onChange={e => update('openingBalance', +e.target.value)} />
                </div>
              </div>
              <div>
                <Label>پتہ</Label>
                <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="پتہ" />
              </div>
              <div>
                <Label>کمنٹ / نوٹس</Label>
                <Textarea value={form.comments} onChange={e => update('comments', e.target.value)} placeholder="کسٹمر کے بارے میں کوئی خاص بات..." rows={3} />
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700 w-full" onClick={handleSave} disabled={loading || !form.name}>
                <Save className="h-4 w-4 mr-2" /> {editing ? 'اپ ڈیٹ' : 'محفوظ + کارڈ بنائیں'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="کسٹمر نام، فون، یا بارکوڈ سیرچ..." value={search} onChange={e => setSearch(e.target.value)} />
        {search && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch('')}><X className="h-3 w-3" /></Button>}
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {customers.length === 0 ? (
          <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground">کوئی کسٹمر نہیں</CardContent></Card>
        ) : customers.map(c => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{c.name}</h3>
                  {c.phone && <p className="text-sm text-muted-foreground">{c.phone}</p>}
                  {c.address && <p className="text-sm text-muted-foreground truncate">{c.address}</p>}
                  {c.comments && <p className="text-xs text-slate-500 mt-1 italic">{c.comments}</p>}
                </div>
                <CreditCard className="h-8 w-8 text-emerald-500 flex-shrink-0" />
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">بیلنس</p>
                  <p className={`font-bold text-lg ${c.balance > 0 ? 'text-red-600' : c.balance < 0 ? 'text-emerald-600' : ''}`}>
                    Rs {c.balance.toLocaleString()}
                  </p>
                </div>
                <div className="text-xs font-mono text-muted-foreground">{c.barcode}</div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => showCard(c)}>
                  <Eye className="h-3 w-3 mr-1" /> کارڈ دیکھیں
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleEdit(c)}><Edit2 className="h-3 w-3" /></Button>
                <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customer Card Dialog */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>کسٹمر کارڈ</DialogTitle>
          </DialogHeader>
          <div id="customer-card-print" className="card bg-white border-2 border-gray-800 rounded-xl p-6 text-center">
            <div className="mb-2">
              <h2 className="text-xl font-bold text-gray-800">TARIQ STORE</h2>
              <p className="text-xs text-gray-500">Customer Loyalty Card</p>
            </div>
            <div className="my-3">
              <svg ref={cardBarcodeRef} className="mx-auto"></svg>
            </div>
            <div className="border-t border-dashed border-gray-300 pt-3 mt-3 text-left">
              <p className="font-bold text-lg">{selectedCustomer?.name}</p>
              {selectedCustomer?.phone && <p className="text-sm text-gray-600">📱 {selectedCustomer.phone}</p>}
              {selectedCustomer?.address && <p className="text-sm text-gray-600">📍 {selectedCustomer.address}</p>}
            </div>
            <div className="bg-emerald-50 rounded-lg p-2 mt-3">
              <p className="text-xs text-emerald-700">بارکوڈ سکین کریں اور خریداری شروع کریں!</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={printCard}>
            <Printer className="h-4 w-4 mr-2" /> کارڈ پرنٹ کریں
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}