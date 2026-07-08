'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface ExpenseType { id: string; name: string; }
interface Expense { id: string; amount: number; description?: string; createdAt: string; expenseType: ExpenseType; }

export function ExpensesPage() {
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
    if (!amount || !selectedType) { toast.error('تمام فیلڈز بھریں'); return; }
    await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseTypeId: selectedType, amount, description }),
    });
    toast.success('اخراجہ محفوظ');
    setOpen(false); setAmount(0); setDescription(''); loadData();
  };

  const handleNewType = async () => {
    if (!newTypeName) return;
    await fetch('/api/expenses/types', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTypeName }),
    });
    toast.success('ٹائپ بن گیا');
    setTypeOpen(false); setNewTypeName(''); loadData();
  };

  const totalToday = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">اخراجات</h2>
        <div className="flex gap-2">
          <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> نیا ٹائپ</Button></DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>نیا اخراجات ٹائپ</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div><Label>ٹائپ نام</Label><Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} /></div>
                <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handleNewType}>محفوظ</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700"><DollarSign className="h-4 w-4 mr-1" /> نیا اخراجہ</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>نیا اخراجہ</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>ٹائپ *</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger><SelectValue placeholder="منتخب کریں" /></SelectTrigger>
                    <SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>رقم *</Label><Input type="number" value={amount} onChange={e => setAmount(+e.target.value)} /></div>
                <div><Label>تفصیل</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={!amount || !selectedType}>محفوظ</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 text-red-600"><DollarSign className="h-5 w-5" /></div>
            <div><p className="text-sm text-muted-foreground">کل اخراجات</p><p className="text-xl font-bold text-red-600">Rs {totalToday.toLocaleString()}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              <th className="text-left p-3">ٹائپ</th><th className="text-right p-3">رقم</th><th className="text-left p-3">تفصیل</th><th className="text-left p-3">تاریخ</th>
            </tr></thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">کوئی اخراجہ نہیں</td></tr>
              ) : expenses.map(e => (
                <tr key={e.id} className="border-b hover:bg-slate-50">
                  <td className="p-3"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">{e.expenseType.name}</span></td>
                  <td className="p-3 text-right font-bold text-red-600">Rs {e.amount.toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground">{e.description || '-'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString('ur-PK')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}