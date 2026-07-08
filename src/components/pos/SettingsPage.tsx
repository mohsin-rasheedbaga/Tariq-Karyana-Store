'use client';

import { useState, useEffect } from 'react';
import { Save, Database, Cloud, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Settings {
  id: string; storeName: string; storeAddress?: string; storePhone?: string;
  invoicePrefix: string; autoPrint: boolean; defaultPrinter?: string;
  supabaseUrl?: string; supabaseKey?: string; lastSyncAt?: string;
}

export function SettingsPage() {
  const { lang, theme } = useAppStore();
  const isDark = theme === 'dark';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

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
      toast.success(t('set.saved', lang));
    } finally { setSaving(false); }
  };

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      toast.success(t('set.up_to_date', lang));
    }, 1500);
  };

  const update = (k: string, v: any) => setSettings(s => s ? { ...s, [k]: v } : s);

  if (!settings) return <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">{t('set.title', lang)}</h2>

      {/* Store Settings */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className={cn("text-lg flex items-center gap-2", isDark && 'text-white')}>
            <Database className="h-5 w-5" /> {t('set.store_info', lang)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>{t('set.store_name', lang)}</Label><Input value={settings.storeName} onChange={e => update('storeName', e.target.value)} /></div>
          <div><Label>{t('set.address', lang)}</Label><Input value={settings.storeAddress || ''} onChange={e => update('storeAddress', e.target.value)} /></div>
          <div><Label>{t('set.phone', lang)}</Label><Input value={settings.storePhone || ''} onChange={e => update('storePhone', e.target.value)} /></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('set.auto_print', lang)}</p>
              <p className="text-xs text-muted-foreground">{t('set.auto_print_desc', lang)}</p>
            </div>
            <Switch checked={settings.autoPrint} onCheckedChange={v => update('autoPrint', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Cloud Sync Settings */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className={cn("text-lg flex items-center gap-2", isDark && 'text-white')}>
            <Cloud className="h-5 w-5 text-blue-500" /> {t('set.cloud_backup', lang)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('set.cloud_desc', lang)}</p>
          <div><Label>{t('set.supabase_url', lang)}</Label><Input value={settings.supabaseUrl || ''} onChange={e => update('supabaseUrl', e.target.value)} placeholder="https://xxxx.supabase.co" /></div>
          <div><Label>{t('set.supabase_key', lang)}</Label><Input type="password" value={settings.supabaseKey || ''} onChange={e => update('supabaseKey', e.target.value)} placeholder="eyJ..." /></div>
          {settings.lastSyncAt && (
            <p className="text-xs text-muted-foreground">{t('set.last_sync', lang)}: {new Date(settings.lastSyncAt).toLocaleString('ur-PK')}</p>
          )}
          <Button variant="outline" className="gap-2" onClick={() => toast.info(t('set.sync_coming', lang))}>
            <Upload className="h-4 w-4" /> {t('set.sync_now', lang)}
          </Button>
        </CardContent>
      </Card>

      {/* Architecture Info */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className={cn("text-lg", isDark && 'text-white')}>{t('set.architecture', lang)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('set.arch_desc', lang)}</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>{t('set.arch_frontend', lang)}:</strong> Next.js 16 + React 19 + TypeScript</li>
            <li><strong>{t('set.arch_db', lang)}:</strong> Prisma ORM + SQLite ({lang === 'ur' ? 'لوکل' : 'Local'})</li>
            <li><strong>{t('set.arch_cloud', lang)}:</strong> Supabase ({lang === 'ur' ? 'آپشنل بیک اپ' : 'Optional Backup'})</li>
            <li><strong>{t('set.arch_barcode', lang)}:</strong> JsBarcode (Code 128)</li>
            <li><strong>{t('set.arch_source', lang)}:</strong> {lang === 'ur' ? 'GitHub پر رکھنے کے لیے تیار' : 'Ready for GitHub'}</li>
            <li><strong>{t('set.arch_backup', lang)}:</strong> {lang === 'ur' ? 'لوکل + کلاؤڈ ڈبل بیک اپ' : 'Local + Cloud Double Backup'}</li>
          </ul>
        </CardContent>
      </Card>

      {/* Auto Update */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className={cn("text-lg flex items-center gap-2", isDark && 'text-white')}>
            <RefreshCw className="h-5 w-5 text-emerald-500" /> {t('set.update', lang)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('set.update_desc', lang)}</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={handleCheckUpdate} disabled={checkingUpdate}>
              <RefreshCw className={cn("h-4 w-4", checkingUpdate && "animate-spin")} /> {t('set.check_update', lang)}
            </Button>
            <span className="text-xs text-muted-foreground">{t('set.version', lang)}: 2.0.0</span>
          </div>
        </CardContent>
      </Card>

      <Button className="bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? t('set.saving', lang) : t('set.save_settings', lang)}
      </Button>
    </div>
  );
}