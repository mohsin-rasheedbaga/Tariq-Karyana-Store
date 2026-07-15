'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  openingBalance: number;
  balance: number;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { name: '', phone: '', address: '', openingBalance: 0 };

export function VendorsPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const currency = t('common.currency', lang);
  const locale = lang === 'ur' ? 'ur-PK' : 'en-US';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/party');
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch {
      setVendors([]);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = vendors.filter(v =>
    !search ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.phone && v.phone.includes(search)) ||
    (v.address && v.address.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      if (editing) {
        const res = await fetch(`/api/party/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, phone: form.phone || null, address: form.address || null }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Error');
          return;
        }
      } else {
        await fetch('/api/party', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || null,
            address: form.address || null,
            openingBalance: form.openingBalance || 0,
          }),
        });
      }
      toast.success(t('ven.saved', lang));
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      loadData();
    } catch {
      toast.error('Error saving vendor');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (v: Vendor) => {
    setEditing(v);
    setForm({ name: v.name, phone: v.phone || '', address: v.address || '', openingBalance: v.openingBalance });
    setOpen(true);
  };

  const handleDelete = async (v: Vendor) => {
    if (!confirm(t('ven.confirm_delete', lang))) return;
    try {
      const res = await fetch(`/api/party/${v.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        toast.error(t('ven.cannot_delete', lang));
        return;
      }
      toast.success(t('cls.deleted', lang));
      loadData();
    } catch {
      toast.error('Error deleting vendor');
    }
  };

  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('ven.title', lang)}</h2>
        {hasPermission('purchases') && (
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" /> {t('ven.new', lang)}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? t('ven.edit_vendor', lang) : t('ven.new', lang)}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>{t('ven.name', lang)} *</Label>
                  <Input
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder={t('ven.name_placeholder', lang)}
                    className={cn(isDark && 'bg-slate-800 border-slate-600')}
                  />
                </div>
                <div>
                  <Label>{t('ven.phone', lang)}</Label>
                  <Input
                    value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                    placeholder={t('ven.phone_placeholder', lang)}
                    className={cn(isDark && 'bg-slate-800 border-slate-600')}
                  />
                </div>
                <div>
                  <Label>{t('ven.address', lang)}</Label>
                  <Input
                    value={form.address}
                    onChange={e => update('address', e.target.value)}
                    placeholder={t('ven.address_placeholder', lang)}
                    className={cn(isDark && 'bg-slate-800 border-slate-600')}
                  />
                </div>
                {!editing && (
                  <div>
                    <Label>{t('ven.opening_balance', lang)}</Label>
                    <Input
                      type="number"
                      value={form.openingBalance}
                      onChange={e => update('openingBalance', +e.target.value)}
                      className={cn(isDark && 'bg-slate-800 border-slate-600')}
                    />
                  </div>
                )}
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 w-full"
                  onClick={handleSave}
                  disabled={loading || !form.name.trim()}
                >
                  <Save className="h-4 w-4 mr-2" /> {t('common.save', lang)}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder={t('ven.search', lang)}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <Button
            variant="ghost" size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearch('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn('border-b', isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50')}>
                  <th className="text-left p-3">{t('ven.name', lang)}</th>
                  <th className="text-left p-3">{t('ven.phone', lang)}</th>
                  <th className="text-left p-3 hidden md:table-cell">{t('ven.address', lang)}</th>
                  <th className="text-right p-3">{t('ven.balance', lang)}</th>
                  <th className="text-right p-3">{t('ven.actions', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('ven.no_vendors', lang)}
                    </td>
                  </tr>
                ) : filtered.map(v => (
                  <tr
                    key={v.id}
                    className={cn(
                      'border-b transition-colors',
                      isDark ? 'border-slate-700 hover:bg-slate-700/60' : 'hover:bg-slate-50'
                    )}
                  >
                    <td className="p-3 font-medium">{v.name}</td>
                    <td className="p-3 text-muted-foreground">{v.phone || '-'}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                      {v.address || '-'}
                    </td>
                    <td className={cn('p-3 text-right font-bold', v.balance > 0 ? 'text-red-600' : v.balance < 0 ? 'text-emerald-600' : '')}>
                      {currency} {v.balance.toLocaleString(locale)}
                      {v.balance > 0 && (
                        <span className="text-[10px] ml-1 text-red-400">({t('ven.credit', lang)})</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {hasPermission('purchases') && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(v)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission('purchases') && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(v)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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