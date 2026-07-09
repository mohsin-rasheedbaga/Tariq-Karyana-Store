'use client';

import { useState, useEffect } from 'react';
import { Plus, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ExpenseType { id: string; name: string; }
interface Expense { id: string; amount: number; description?: string; createdAt: string; expenseType: ExpenseType; }

export function ExpensesPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';
  const canManage = hasPermission('expenses');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [open, setOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [newTypeName, setNewTypeName] = useState('');

  const loadData = async () => {
    const [eRes, tRes] = await Promise.all([
      fetch('/api/expenses').then(r => r.json()),
      fetch('/api/expenses/types').then(r => r.json()),
    ]);
    setExpenses(Array.isArray(eRes) ? eRes : []);
    setTypes(Array.isArray(tRes) ? tRes : []);
  };

  useEffect(() => { void loadData(); }, []);

  const handleSave = async () => {
    if (!amount || !selectedType) {
      toast.error(t('exp.fill_fields', lang));
      return;
    }
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseTypeId: selectedType, amount, description }),
    });
    toast.success(t('exp.saved', lang));
    setOpen(false);
    setAmount(0);
    setDescription('');
    setSelectedType('');
    void loadData();
  };

  const handleNewType = async () => {
    if (!newTypeName) return;
    await fetch('/api/expenses/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTypeName }),
    });
    toast.success(t('exp.type_created', lang));
    setTypeOpen(false);
    setNewTypeName('');
    void loadData();
  };

  const totalToday = expenses.reduce((s, e) => s + e.amount, 0);
  const currency = t('common.currency', lang);
  const locale = lang === 'ur' ? 'ur-PK' : 'en-US';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('exp.title', lang)}</h2>
        {canManage && (
          <div className="flex gap-2">
            {/* New Type Dialog */}
            <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> {t('exp.new_type', lang)}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t('exp.new_expense_type', lang)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>{t('exp.type_name', lang)}</Label>
                    <Input
                      value={newTypeName}
                      onChange={e => setNewTypeName(e.target.value)}
                      className={cn(isDark && 'bg-slate-800 border-slate-600')}
                    />
                  </div>
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={handleNewType}
                    disabled={!newTypeName}
                  >
                    {t('common.save', lang)}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* New Expense Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700">
                  <DollarSign className="h-4 w-4 mr-1" /> {t('exp.new', lang)}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t('exp.new', lang)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>{t('exp.type', lang)} *</Label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className={cn(isDark && 'bg-slate-800 border-slate-600')}>
                        <SelectValue placeholder={t('exp.select_type', lang)} />
                      </SelectTrigger>
                      <SelectContent>
                        {types.map(tp => (
                          <SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('exp.amount', lang)} *</Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(+e.target.value)}
                      className={cn(isDark && 'bg-slate-800 border-slate-600')}
                    />
                  </div>
                  <div>
                    <Label>{t('exp.description', lang)}</Label>
                    <Input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className={cn(isDark && 'bg-slate-800 border-slate-600')}
                    />
                  </div>
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={handleSave}
                    disabled={!amount || !selectedType}
                  >
                    {t('exp.save', lang)}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Total Card */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-50 text-red-600'
            )}>
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('exp.total', lang)}</p>
              <p className="text-xl font-bold text-red-600">
                {currency} {totalToday.toLocaleString(locale)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn(
                  'border-b',
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50'
                )}>
                  <th className="text-left p-3">{t('exp.type', lang)}</th>
                  <th className="text-right p-3">{t('exp.amount', lang)}</th>
                  <th className="text-left p-3">{t('exp.description', lang)}</th>
                  <th className="text-left p-3">{t('exp.date', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t('exp.no_expenses', lang)}
                    </td>
                  </tr>
                ) : expenses.map(e => (
                  <tr
                    key={e.id}
                    className={cn(
                      'border-b transition-colors',
                      isDark
                        ? 'border-slate-700 hover:bg-slate-700/60'
                        : 'hover:bg-slate-50'
                    )}
                  >
                    <td className="p-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs',
                        isDark
                          ? 'bg-red-900/50 text-red-300'
                          : 'bg-red-100 text-red-700'
                      )}>
                        {e.expenseType.name}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-red-600">
                      {currency} {e.amount.toLocaleString(locale)}
                    </td>
                    <td className="p-3 text-muted-foreground">{e.description || '-'}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString(locale)}
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