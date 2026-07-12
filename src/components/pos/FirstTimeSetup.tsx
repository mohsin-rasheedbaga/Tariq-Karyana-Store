'use client';

import { useState } from 'react';
import { Store, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FirstTimeSetupProps {
  onComplete: () => void;
  lang: 'en' | 'ur';
}

export function FirstTimeSetup({ onComplete, lang }: FirstTimeSetupProps) {
  const [step, setStep] = useState(1); // 1: Store name, 2: Username/password, 3: Done
  const [storeName, setStoreName] = useState('Tariq Karyana Store');
  const [storePhone, setStorePhone] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStep1 = async () => {
    if (!storeName.trim()) {
      toast.error(lang === 'ur' ? 'دکان کا نام ضروری ہے' : 'Store name is required');
      return;
    }
    setSaving(true);
    try {
      // Save store name
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: storeName.trim(), storePhone: storePhone.trim() }),
      });
      setStep(2);
    } catch {
      toast.error(lang === 'ur' ? 'محفوظ نہیں ہو سکا' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleStep2 = async () => {
    if (!username.trim()) {
      toast.error(lang === 'ur' ? 'یوزر نیم ضروری ہے' : 'Username is required');
      return;
    }
    if (!password || password.length < 4) {
      toast.error(lang === 'ur' ? 'پاسورڈ کم از کم 4 حروف' : 'Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error(lang === 'ur' ? 'پاسورڈ مماثل نہیں' : 'Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      // Update admin credentials
      const usersRes = await fetch('/api/users');
      const users = await usersRes.json();
      const admin = Array.isArray(users) ? (users.find((u: any) => u.role === 'admin') || users[0]) : null;
      if (!admin) {
        toast.error(lang === 'ur' ? 'ایڈمن نہیں ملا' : 'Admin not found');
        return;
      }
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: admin.id, username: username.trim(), password }),
      });
      // Mark setup as done
      localStorage.setItem('pos-setup-done', 'true');
      setStep(3);
    } catch {
      toast.error(lang === 'ur' ? 'محفوظ نہیں ہو سکا' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-emerald-900 via-slate-900 to-blue-900 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-4">
            <Store className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Tariq Karyana Store</h1>
          <p className="text-emerald-300/80 text-sm mt-1">
            {lang === 'ur' ? 'پہلی بار سیٹ اپ' : 'First Time Setup'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                s < step ? 'bg-emerald-500 text-white' :
                s === step ? 'bg-emerald-500/30 text-emerald-300 border-2 border-emerald-400' :
                'bg-slate-700 text-slate-500'
              )}>
                {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={cn("w-8 h-0.5", s < step ? 'bg-emerald-500' : 'bg-slate-700')} />}
            </div>
          ))}
        </div>

        <Card className="bg-slate-800/80 border-slate-700 backdrop-blur-sm">
          <CardContent className="p-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <Store className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                  <h2 className="text-lg font-bold text-white">
                    {lang === 'ur' ? 'دکان کی معلومات' : 'Store Information'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {lang === 'ur' ? 'اپنی دکان کا نام اور فون نمبر درج کریں' : 'Enter your store name and phone number'}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-300">{lang === 'ur' ? 'دکان کا نام' : 'Store Name'} *</Label>
                  <Input
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder={lang === 'ur' ? 'مثلاً: Tariq Karyana Store' : 'e.g. Tariq Karyana Store'}
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-slate-300">{lang === 'ur' ? 'فون نمبر' : 'Phone Number'}</Label>
                  <Input
                    value={storePhone}
                    onChange={e => setStorePhone(e.target.value)}
                    placeholder={lang === 'ur' ? '03XX-XXXXXXX' : '03XX-XXXXXXX'}
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 gap-2"
                  onClick={handleStep1}
                  disabled={saving || !storeName.trim()}
                >
                  {lang === 'ur' ? 'اگلا' : 'Next'} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <User className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                  <h2 className="text-lg font-bold text-white">
                    {lang === 'ur' ? 'ایڈمن اکاؤنٹ' : 'Admin Account'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {lang === 'ur' ? 'ایڈمن کا یوزر نیم اور پاسورڈ سیٹ کریں' : 'Set admin username and password'}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-300">{lang === 'ur' ? 'یوزر نیم' : 'Username'} *</Label>
                  <Input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="mt-1 bg-slate-700 border-slate-600 text-white font-mono"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-slate-300">{lang === 'ur' ? 'پاسورڈ' : 'Password'} *</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={lang === 'ur' ? 'کم از کم 4 حروف' : 'Minimum 4 characters'}
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">{lang === 'ur' ? 'پاسورڈ دوبارہ' : 'Confirm Password'} *</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={lang === 'ur' ? 'پاسورڈ دوبارہ لکھیں' : 'Re-enter password'}
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 gap-2"
                  onClick={handleStep2}
                  disabled={saving || !username.trim() || !password || password.length < 4 || password !== confirmPassword}
                >
                  {saving ? '...' : (lang === 'ur' ? 'سیٹ اپ مکمل' : 'Complete Setup')}
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="text-center space-y-4 py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {lang === 'ur' ? 'سیٹ اپ مکمل!' : 'Setup Complete!'}
                </h2>
                <p className="text-sm text-slate-400">
                  {lang === 'ur'
                    ? 'آپ کا کریانہ سٹور POS سسٹم تیار ہے۔ کریانہ اسٹور کی مصنوعات خود بخود شامل ہو چکی ہیں۔'
                    : 'Your Karyana Store POS system is ready. Sample kiryana products have been added automatically.'}
                </p>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 gap-2 text-lg"
                  onClick={onComplete}
                >
                  {lang === 'ur' ? 'شروع کریں' : 'Get Started'} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-4">v1.2.1 &middot; POS System</p>
      </div>
    </div>
  );
}