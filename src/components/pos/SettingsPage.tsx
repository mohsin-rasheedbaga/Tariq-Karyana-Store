'use client';

import { useState, useEffect } from 'react';
import { Save, Database, Cloud, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

interface Settings {
  id: string; storeName: string; storeAddress?: string; storePhone?: string;
  invoicePrefix: string; autoPrint: boolean; defaultPrinter?: string;
  supabaseUrl?: string; supabaseKey?: string; lastSyncAt?: string;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      toast.success('سیٹنگز محفوظ');
    } finally { setSaving(false); }
  };

  const update = (k: string, v: any) => setSettings(s => s ? { ...s, [k]: v } : s);

  if (!settings) return <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <Toaster />
      <h2 className="text-2xl font-bold">سیٹنگز</h2>

      {/* Store Settings */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5" /> دکان کی معلومات</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>دکان کا نام</Label><Input value={settings.storeName} onChange={e => update('storeName', e.target.value)} /></div>
          <div><Label>پتہ</Label><Input value={settings.storeAddress || ''} onChange={e => update('storeAddress', e.target.value)} /></div>
          <div><Label>فون</Label><Input value={settings.storePhone || ''} onChange={e => update('storePhone', e.target.value)} /></div>
          <div className="flex items-center justify-between">
            <div><p className="font-medium">آٹو پرنٹ</p><p className="text-xs text-muted-foreground">سیل سیو ہوتے ہی بِل پرنٹ</p></div>
            <Switch checked={settings.autoPrint} onCheckedChange={v => update('autoPrint', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Cloud Sync Settings */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Cloud className="h-5 w-5 text-blue-500" /> کلاؤڈ بیک اپ (Supabase)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Supabase سے کنیکٹ کریں تاکہ آپ کا ڈیٹا آن لائن محفوظ رہے۔ کمپیوٹر خراب ہونے پر ڈیٹا محفوظ رہے گا۔
          </p>
          <div><Label>Supabase URL</Label><Input value={settings.supabaseUrl || ''} onChange={e => update('supabaseUrl', e.target.value)} placeholder="https://xxxx.supabase.co" /></div>
          <div><Label>Supabase Key</Label><Input type="password" value={settings.supabaseKey || ''} onChange={e => update('supabaseKey', e.target.value)} placeholder="eyJ..." /></div>
          {settings.lastSyncAt && (
            <p className="text-xs text-muted-foreground">آخری سنک: {new Date(settings.lastSyncAt).toLocaleString('ur-PK')}</p>
          )}
          <Button variant="outline" className="gap-2" onClick={() => toast.info('سنک فیچر جلد فعال ہوگا')}>
            <Upload className="h-4 w-4" /> ابھی سنک کریں
          </Button>
        </CardContent>
      </Card>

      {/* Architecture Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">سسٹم آرکیٹیکچر</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>یہ سسٹم جدید ٹیکنالوجی پر بنایا گیا ہے:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>فرنٹ اینڈ:</strong> Next.js 16 + React 19 + TypeScript</li>
            <li><strong>ڈیٹابیس:</strong> Prisma ORM + SQLite (لوکل)</li>
            <li><strong>کلاؤڈ:</strong> Supabase (آپشنل بیک اپ)</li>
            <li><strong>بارکوڈ:</strong> JsBarcode (Code 128)</li>
            <li><strong>سورس کوڈ:</strong> GitHub پر رکھنے کے لیے تیار</li>
            <li><strong>بیک اپ:</strong> لوکل + کلاؤڈ ڈبل بیک اپ</li>
          </ul>
        </CardContent>
      </Card>

      <Button className="bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? 'محفوظ ہو رہا ہے...' : 'سیٹنگز محفوظ'}
      </Button>
    </div>
  );
}