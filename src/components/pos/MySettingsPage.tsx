'use client';

import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MySettingsPage() {
  const { lang, theme, user, token } = useAppStore();
  const isDark = theme === 'dark';
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) {
      toast.error(t('myset.fill_all', lang));
      return;
    }
    if (newPass !== confirmPass) {
      toast.error(t('myset.passwords_no_match', lang));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user?.id, currentPassword: currentPass, password: newPass }),
      });
      if (res.ok) {
        toast.success(t('myset.password_changed', lang));
        setCurrentPass(''); setNewPass(''); setConfirmPass('');
      } else {
        const data = await res.json();
        toast.error(data.error || t('myset.wrong_current', lang));
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-2xl font-bold">{t('myset.title', lang)}</h2>

      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-amber-500" />
            {t('myset.change_password', lang)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('myset.current_password', lang)}</Label>
            <Input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t('myset.new_password', lang)}</Label>
            <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t('myset.confirm_password', lang)}</Label>
            <Input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="mt-1" />
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 w-full" onClick={handleChangePassword} disabled={loading}>
            <Save className="h-4 w-4 mr-2" /> {loading ? '...' : t('myset.save', lang)}
          </Button>
        </CardContent>
      </Card>

      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
              {user?.fullName?.[0] || '?'}
            </div>
            <div>
              <p className="font-bold text-lg">{user?.fullName}</p>
              <p className="text-sm text-muted-foreground">@{user?.username} &middot; {user?.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}