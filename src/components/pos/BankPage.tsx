'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Plus, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Account {
  id: string;
  bankName: string;
  branchName?: string;
  accountNo?: string;
  balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export function BankPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnType, setTxnType] = useState('deposit');
  const [txnAmount, setTxnAmount] = useState(0);
  const [txnDesc, setTxnDesc] = useState('');

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/bank');
    const data = await res.json();
    setAccounts(Array.isArray(data) ? data : []);
  }, []);

  const loadTransactions = useCallback(async (accountId: string) => {
    const res = await fetch(`/api/bank/transaction?accountId=${accountId}`);
    const data = await res.json();
    setTransactions(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selected) {
      void loadTransactions(selected);
    }
  }, [selected, loadTransactions]);

  const currentAccount = accounts.find((a) => a.id === selected);

  const handleTxn = async () => {
    if (!txnAmount || !selected) return;
    await fetch('/api/bank/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankAccountId: selected,
        type: txnType,
        amount: txnAmount,
        description: txnDesc,
      }),
    });
    toast.success(
      txnType === 'deposit'
        ? t('bank.deposit_done', lang)
        : t('bank.draw_done', lang)
    );
    setTxnOpen(false);
    setTxnAmount(0);
    setTxnDesc('');
    loadAccounts();
    loadTransactions(selected);
  };

  if (!hasPermission('bank')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('bank.title', lang)}</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              className={cn(
                'bg-slate-700 hover:bg-slate-800',
                isDark && 'bg-slate-600 hover:bg-slate-500'
              )}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('bank.new_account', lang)}
            </Button>
          </DialogTrigger>
          <DialogContent
            className={cn(
              'max-w-sm',
              isDark && 'bg-slate-900 border-slate-700'
            )}
          >
            <DialogHeader>
              <DialogTitle>{t('bank.new_bank_account', lang)}</DialogTitle>
            </DialogHeader>
            <NewAccountForm onSave={loadAccounts} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <Card
            key={acc.id}
            className={cn(
              'cursor-pointer transition-shadow hover:shadow-md',
              selected === acc.id && 'ring-2 ring-emerald-500',
              isDark && 'bg-slate-900 border-slate-700 hover:bg-slate-800'
            )}
            onClick={() => setSelected(acc.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'p-2 rounded-lg',
                    isDark ? 'bg-slate-800' : 'bg-slate-100'
                  )}
                >
                  <CreditCard
                    className={cn(
                      'h-5 w-5',
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    )}
                  />
                </div>
                <div>
                  <p className="font-bold">{acc.bankName}</p>
                  {acc.branchName && (
                    <p className="text-xs text-muted-foreground">
                      {acc.branchName}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-2xl font-bold mt-3 text-emerald-600">
                {t('common.currency', lang)} {acc.balance.toLocaleString()}
              </p>
              {acc.accountNo && (
                <p className="text-xs text-muted-foreground font-mono">
                  {acc.accountNo}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && (
          <Card
            className={cn(
              'col-span-full',
              isDark && 'bg-slate-900 border-slate-700'
            )}
          >
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('bank.no_accounts', lang)}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transactions Section */}
      {currentAccount && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">
              {currentAccount.bankName} - {t('bank.transactions', lang)}
            </h3>
            <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-1" />
                  {t('bank.new_txn', lang)}
                </Button>
              </DialogTrigger>
              <DialogContent
                className={cn(
                  'max-w-sm',
                  isDark && 'bg-slate-900 border-slate-700'
                )}
              >
                <DialogHeader>
                  <DialogTitle>{t('bank.new_txn', lang)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>{t('bank.type', lang)}</Label>
                    <Select value={txnType} onValueChange={setTxnType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        className={isDark && 'bg-slate-900 border-slate-700'}
                      >
                        <SelectItem value="deposit">
                          {t('bank.deposit_label', lang)}
                        </SelectItem>
                        <SelectItem value="draw">
                          {t('bank.draw_label', lang)}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('bank.deposit', lang)}</Label>
                    <Input
                      type="number"
                      value={txnAmount}
                      onChange={(e) => setTxnAmount(+e.target.value)}
                      className={isDark && 'bg-slate-800 border-slate-700'}
                    />
                  </div>
                  <div>
                    <Label>{t('bank.description', lang)}</Label>
                    <Input
                      value={txnDesc}
                      onChange={(e) => setTxnDesc(e.target.value)}
                      className={isDark && 'bg-slate-800 border-slate-700'}
                    />
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleTxn}
                    disabled={!txnAmount}
                  >
                    {t('common.save', lang)}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className={isDark && 'bg-slate-900 border-slate-700'}>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={cn(
                      'border-b',
                      isDark ? 'bg-slate-800' : 'bg-slate-50'
                    )}
                  >
                    <th className="text-left p-3">{t('bank.type', lang)}</th>
                    <th className="text-right p-3">
                      {t('bank.deposit', lang)}
                    </th>
                    <th className="text-left p-3">
                      {t('bank.description', lang)}
                    </th>
                    <th className="text-left p-3">{t('bank.date', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className={cn(
                        'border-b',
                        isDark && 'hover:bg-slate-800'
                      )}
                    >
                      <td className="p-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs',
                            txn.type === 'deposit'
                              ? isDark
                                ? 'bg-emerald-900/40 text-emerald-400'
                                : 'bg-emerald-100 text-emerald-700'
                              : isDark
                                ? 'bg-red-900/40 text-red-400'
                                : 'bg-red-100 text-red-700'
                          )}
                        >
                          {txn.type === 'deposit'
                            ? t('bank.deposit', lang)
                            : t('bank.draw', lang)}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'p-3 text-right font-bold',
                          txn.type === 'deposit'
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        )}
                      >
                        {txn.type === 'deposit' ? '+' : '-'}
                        {t('common.currency', lang)}{' '}
                        {txn.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {txn.description || '-'}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(txn.createdAt).toLocaleDateString(
                          lang === 'ur' ? 'ur-PK' : 'en-US'
                        )}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {t('bank.no_txn', lang)}
                      </td>
                    </tr>
                  )}
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
  const { lang, theme } = useAppStore();
  const isDark = theme === 'dark';

  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [accNo, setAccNo] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = async () => {
    if (!bankName) return;
    await fetch('/api/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName,
        branchName: branch,
        accountNo: accNo,
        phone,
      }),
    });
    setBankName('');
    setBranch('');
    setAccNo('');
    setPhone('');
    onSave();
  };

  return (
    <div className="space-y-3 py-2">
      <div>
        <Label>{t('bank.bank_name', lang)} *</Label>
        <Input
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className={isDark && 'bg-slate-800 border-slate-700'}
        />
      </div>
      <div>
        <Label>{t('bank.branch', lang)}</Label>
        <Input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className={isDark && 'bg-slate-800 border-slate-700'}
        />
      </div>
      <div>
        <Label>{t('bank.account_no', lang)}</Label>
        <Input
          value={accNo}
          onChange={(e) => setAccNo(e.target.value)}
          className={isDark && 'bg-slate-800 border-slate-700'}
        />
      </div>
      <div>
        <Label>{t('bank.phone', lang)}</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={isDark && 'bg-slate-800 border-slate-700'}
        />
      </div>
      <Button
        className={cn(
          'w-full',
          isDark
            ? 'bg-slate-600 hover:bg-slate-500'
            : 'bg-slate-700 hover:bg-slate-800'
        )}
        onClick={handleSave}
        disabled={!bankName}
      >
        {t('common.save', lang)}
      </Button>
    </div>
  );
}