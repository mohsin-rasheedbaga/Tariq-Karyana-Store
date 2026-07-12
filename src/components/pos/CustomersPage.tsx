'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, CreditCard, X, Save, Printer, Eye, Wallet, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Customer {
  id: string; barcode: string; name: string; phone?: string; address?: string;
  comments?: string; cardType: string; accountNo: string;
  openingBalance: number; balance: number; isActive: boolean; createdAt: string;
}

const emptyCustomer = { name: '', phone: '', address: '', comments: '', openingBalance: 0, cardType: 'regular' };

export function CustomersPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositing, setDepositing] = useState(false);
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
      toast.success(lang === 'ur' ? 'کسٹمر محفوظ ہو گیا' : 'Customer saved');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'ur' ? 'کسٹمر غیر فعال کریں؟' : 'Disable this customer?')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    loadData();
  };

  const handleEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', comments: c.comments || '', openingBalance: c.openingBalance, cardType: c.cardType || 'regular' });
    setOpen(true);
  };

  const handleAddBalance = async () => {
    if (!selectedCustomer || !depositAmount || +depositAmount <= 0) return;
    setDepositing(true);
    try {
      await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: +depositAmount, description: depositDesc || 'Advance Deposit' }),
      });
      toast.success(lang === 'ur' ? `Rs ${depositAmount} بیلنس میں شامل` : `Rs ${depositAmount} added to balance`);
      setDepositAmount(''); setDepositDesc(''); setBalanceOpen(false); loadData();
    } catch {
      toast.error(lang === 'ur' ? 'بیلنس شامل نہیں ہو سکا' : 'Failed to add balance');
    } finally { setDepositing(false); }
  };

  const showCard = (c: Customer) => {
    setSelectedCustomer(c);
    setCardOpen(true);
    setTimeout(() => {
      if (cardBarcodeRef.current) {
        import('jsbarcode').then(JsBarcode => {
          JsBarcode.default(cardBarcodeRef.current, c.barcode, {
            format: 'CODE128', width: 2.5, height: 60, displayValue: true, fontSize: 16, margin: 5,
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
    const isWholesale = selectedCustomer?.cardType === 'wholesale';
    const bgColor = isWholesale ? '#1e3a5f' : '#065f46';
    w.document.write(`<html><head><title>Customer Card - ${selectedCustomer?.name}</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:Arial,sans-serif;}
      .card{width:350px;border:2px solid #000;border-radius:12px;padding:20px;text-align:center;background:${bgColor};color:#fff;}
      .card h2{margin:0 0 5px;font-size:18px;} .card p{margin:2px 0;font-size:13px;}
      .barcode-svg{margin:10px auto;} .barcode-svg svg{filter:invert(1);}
      .info{text-align:left;border-top:1px dashed rgba(255,255,255,0.4);padding-top:10px;margin-top:10px;}
      .badge{display:inline-block;padding:2px 12px;border-radius:20px;font-size:11px;font-weight:bold;margin-top:6px;}
      .ws-badge{background:#f59e0b;color:#000;} .reg-badge{background:#10b981;color:#fff;}
      </style></head><body>`);
    w.document.write(cardEl.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('cust.title', lang)}</h2>
        {hasPermission('customers') && (
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyCustomer); }}}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" /> {t('cust.new', lang)}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? t('cust.edit', lang) : t('cust.new', lang)}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>{t('cust.name', lang)} *</Label>
                  <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder={t('cust.name_placeholder', lang)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t('cust.phone', lang)}</Label>
                    <Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder={t('cust.phone_placeholder', lang)} />
                  </div>
                  <div>
                    <Label>{lang === 'ur' ? 'کارڈ ٹائپ' : 'Card Type'}</Label>
                    <Select value={form.cardType} onValueChange={v => update('cardType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">{lang === 'ur' ? 'عام کسٹمر' : 'Regular Customer'}</SelectItem>
                        <SelectItem value="wholesale">{lang === 'ur' ? 'ہول سیلر' : 'Wholesale'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t('cust.opening_balance', lang)}</Label>
                  <Input type="number" value={form.openingBalance} onChange={e => update('openingBalance', +e.target.value)} />
                </div>
                <div>
                  <Label>{t('cust.address', lang)}</Label>
                  <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder={t('cust.address_placeholder', lang)} />
                </div>
                <div>
                  <Label>{t('cust.comments', lang)}</Label>
                  <Textarea value={form.comments} onChange={e => update('comments', e.target.value)} placeholder={t('cust.comments_placeholder', lang)} rows={3} />
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700 w-full" onClick={handleSave} disabled={loading || !form.name}>
                  <Save className="h-4 w-4 mr-2" /> {editing ? t('common.save', lang) : t('cust.save_card', lang)}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder={t('cust.search', lang)} value={search} onChange={e => setSearch(e.target.value)} />
        {search && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch('')}><X className="h-3 w-3" /></Button>}
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {customers.length === 0 ? (
          <Card className={cn("col-span-full", isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="py-12 text-center text-muted-foreground">{t('cust.no_customers', lang)}</CardContent>
          </Card>
        ) : customers.map(c => {
          const isWs = c.cardType === 'wholesale';
          return (
          <Card key={c.id} className={cn("hover:shadow-md transition-shadow relative overflow-hidden", isDark && 'bg-slate-800 border-slate-700')}>
            {/* Color strip */}
            <div className={cn("absolute top-0 left-0 right-0 h-1", isWs ? 'bg-amber-500' : 'bg-emerald-500')} />
            <CardContent className="p-4 pt-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <Badge className={cn("text-[10px]", isWs ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>
                      {isWs ? (lang === 'ur' ? 'ہول سیل' : 'WHOLESALE') : (lang === 'ur' ? 'عام' : 'REGULAR')}
                    </Badge>
                  </div>
                  {c.phone && <p className="text-sm text-muted-foreground">{c.phone}</p>}
                  {c.address && <p className="text-sm text-muted-foreground truncate">{c.address}</p>}
                  {c.accountNo && <p className="text-xs font-mono text-muted-foreground mt-1">{c.accountNo}</p>}
                </div>
                <CreditCard className={cn("h-8 w-8 flex-shrink-0", isWs ? 'text-amber-500' : 'text-emerald-500')} />
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">{t('cust.balance', lang)}</p>
                  <p className={cn("font-bold text-lg", c.balance > 0 ? 'text-red-600' : c.balance < 0 ? 'text-emerald-600' : '')}>
                    Rs {c.balance.toLocaleString()}
                  </p>
                </div>
                <div className="text-xs font-mono text-muted-foreground">{c.barcode.slice(0, 12)}...</div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => showCard(c)}>
                  <Eye className="h-3 w-3 mr-1" /> {t('cust.view_card', lang)}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setSelectedCustomer(c); setBalanceOpen(true); }}>
                  <Wallet className="h-3 w-3 mr-1" /> {lang === 'ur' ? 'بیلنس' : 'Balance'}
                </Button>
                {hasPermission('customers') && <Button variant="outline" size="sm" onClick={() => handleEdit(c)}><Edit2 className="h-3 w-3" /></Button>}
                {hasPermission('customers') && <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>}
              </div>
            </CardContent>
          </Card>
        ); })}
      </div>

      {/* Customer Card Dialog */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('cust.card', lang)}</DialogTitle>
          </DialogHeader>
          <div id="customer-card-print" className={cn("card border-2 border-gray-800 rounded-xl p-6 text-center", selectedCustomer?.cardType === 'wholesale' ? 'bg-blue-900 text-white' : 'bg-emerald-800 text-white')}>
            <div className="mb-2">
              <h2 className="text-xl font-bold">TARIQ KARYANA STORE</h2>
              <p className="text-xs opacity-80">{lang === 'ur' ? 'کسٹمر کارڈ' : 'Customer Card'}</p>
              <div className="mt-2">
                {selectedCustomer?.cardType === 'wholesale' ? (
                  <span className="inline-block bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">{lang === 'ur' ? 'ہول سیل کارڈ' : 'WHOLESALE CARD'}</span>
                ) : (
                  <span className="inline-block bg-emerald-400 text-white text-xs font-bold px-3 py-1 rounded-full">{lang === 'ur' ? 'عام کسٹمر کارڈ' : 'REGULAR CARD'}</span>
                )}
              </div>
            </div>
            <div className="my-3 bg-white rounded-lg p-2 inline-block">
              <svg ref={cardBarcodeRef} className="mx-auto"></svg>
            </div>
            <div className="border-t border-dashed border-white/30 pt-3 mt-3 text-left">
              <p className="font-bold text-lg">{selectedCustomer?.name}</p>
              {selectedCustomer?.accountNo && <p className="text-sm opacity-80 font-mono">{lang === 'ur' ? 'اکاؤنٹ' : 'Account'}: {selectedCustomer.accountNo}</p>}
              {selectedCustomer?.phone && <p className="text-sm opacity-80">📞 {selectedCustomer.phone}</p>}
              {selectedCustomer?.address && <p className="text-sm opacity-80">📍 {selectedCustomer.address}</p>}
            </div>
            <div className="bg-white/10 rounded-lg p-2 mt-3">
              <p className="text-xs opacity-80">{t('cust.scan_prompt', lang)}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={printCard}>
            <Printer className="h-4 w-4 mr-2" /> {t('cust.print_card', lang)}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Add Balance Dialog */}
      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-600" /> {lang === 'ur' ? 'بیلنس شامل کریں' : 'Add Balance'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className={cn("rounded-lg p-3", isDark ? 'bg-slate-700' : 'bg-slate-50')}>
              <p className="font-bold">{selectedCustomer?.name}</p>
              <p className="text-xs text-muted-foreground">{selectedCustomer?.accountNo}</p>
              <p className="text-sm mt-1">{lang === 'ur' ? 'موجودہ بیلنس' : 'Current Balance'}: <span className="font-bold text-red-600">Rs {selectedCustomer?.balance?.toLocaleString() || 0}</span></p>
            </div>
            <div>
              <Label>{lang === 'ur' ? 'رقم (Rs)' : 'Amount (Rs)'}</Label>
              <Input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="5000" className="text-lg h-12" autoFocus />
            </div>
            <div>
              <Label>{lang === 'ur' ? 'تفصیل' : 'Description'}</Label>
              <Input value={depositDesc} onChange={e => setDepositDesc(e.target.value)} placeholder={lang === 'ur' ? 'ایڈوانس پیمنٹ' : 'Advance payment'} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-11" onClick={handleAddBalance} disabled={depositing || !depositAmount || +depositAmount <= 0}>
              <Wallet className="h-4 w-4 mr-2" /> {depositing ? '...' : (lang === 'ur' ? 'بیلنس شامل کریں' : 'Add Balance')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}