'use client';

import { DollarSign, Wallet, CreditCard, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Account { id: string; bankName: string; branchName?: string; accountNo?: string; balance: number; }
interface Transaction { id: string; type: string; amount: number; description?: string; createdAt: string; }

export function BankPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnType, setTxnType] = useState('deposit');
  const [txnAmount, setTxnAmount] = useState(0);
  const [txnDesc, setTxnDesc] = useState('');

  const loadAccounts = async () => {
    const res = await fetch('/api/bank');
    setAccounts(Array.isArray(await res.json()) ? accounts : []);
    const data = Array.isArray(await res.json()) ? await res.json() : [];
    setAccounts(data);
  };

  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    if (selected) {
      fetch(`/api/bank/transaction?accountId=${selected}`).then(r => r.json()).then(d => setTransactions(Array.isArray(d) ? d : []));
    }
  }, [selected]);

  const currentAccount = accounts.find(a => a.id === selected);

  const handleTxn = async () => {
    if (!txnAmount || !selected) return;
    await fetch('/api/bank/transaction', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankAccountId: selected, type: txnType, amount: txnAmount, description: txnDesc }),
    });
    toast.success(txnType === 'deposit' ? 'امانت داخل' : 'امانت خارج');
    setTxnOpen(false); setTxnAmount(0); setTxnDesc('');
    loadAccounts();
    fetch(`/api/bank/transaction?accountId=${selected}`).then(r => r.json()).then(d => setTransactions(Array.isArray(d) ? d : []));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">بینک اکاؤنٹس</h2>
        <Dialog>
          <DialogTrigger asChild><Button className="bg-slate-700 hover:bg-slate-800">+ نیا اکاؤنٹ</Button></DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>نیا بینک اکاؤنٹ</DialogTitle></DialogHeader>
            <NewAccountForm onSave={loadAccounts} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => (
          <Card key={acc.id} className={`cursor-pointer transition-shadow hover:shadow-md ${selected === acc.id ? 'ring-2 ring-emerald-500' : ''}`} onClick={() => setSelected(acc.id)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100"><CreditCard className="h-5 w-5 text-slate-600" /></div>
                <div>
                  <p className="font-bold">{acc.bankName}</p>
                  {acc.branchName && <p className="text-xs text-muted-foreground">{acc.branchName}</p>}
                </div>
              </div>
              <p className="text-2xl font-bold mt-3 text-emerald-600">Rs {acc.balance.toLocaleString()}</p>
              {acc.accountNo && <p className="text-xs text-muted-foreground font-mono">{acc.accountNo}</p>}
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">کوئی اکاؤنٹ نہیں</CardContent></Card>}
      </div>

      {currentAccount && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{currentAccount.bankName} - ٹرانزیکشنز</h3>
            <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
              <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700">+ نئی ٹرانزیکشن</Button></DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>نئی ٹرانزیکشن</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>ٹائپ</Label>
                    <Select value={txnType} onValueChange={setTxnType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">امانت داخل (Deposit)</SelectItem>
                        <SelectItem value="draw">امانت خارج (Draw)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>رقم</Label><Input type="number" value={txnAmount} onChange={e => setTxnAmount(+e.target.value)} /></div>
                  <div><Label>تفصیل</Label><Input value={txnDesc} onChange={e => setTxnDesc(e.target.value)} /></div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleTxn} disabled={!txnAmount}>محفوظ</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b">
                  <th className="text-left p-3">ٹائپ</th><th className="text-right p-3">رقم</th><th className="text-left p-3">تفصیل</th><th className="text-left p-3">تاریخ</th>
                </tr></thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {t.type === 'deposit' ? 'داخل' : 'خارج'}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-bold ${t.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'deposit' ? '+' : '-'}Rs {t.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-muted-foreground">{t.description || '-'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString('ur-PK')}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">کوئی ٹرانزیکشن نہیں</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function NewAccountForm({ onSave }: { onSave: () => void }) {
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [accNo, setAccNo] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = async () => {
    if (!bankName) return;
    await fetch('/api/bank', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankName, branchName: branch, accountNo: accNo, phone }),
    });
    setBankName(''); setBranch(''); setAccNo(''); setPhone('');
    onSave();
  };

  return (
    <div className="space-y-3 py-2">
      <div><Label>بینک نام *</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} /></div>
      <div><Label>برانچ</Label><Input value={branch} onChange={e => setBranch(e.target.value)} /></div>
      <div><Label>اکاؤنٹ نمبر</Label><Input value={accNo} onChange={e => setAccNo(e.target.value)} /></div>
      <div><Label>فون</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
      <Button className="w-full bg-slate-700 hover:bg-slate-800" onClick={handleSave} disabled={!bankName}>محفوظ</Button>
    </div>
  );
}