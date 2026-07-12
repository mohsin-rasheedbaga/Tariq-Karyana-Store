'use client';

import { useState, useEffect } from 'react';
import { Save, Database, Cloud, Upload, RefreshCw, Printer, Search, TestTube2, Info, Shield, Eye, EyeOff, Download, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [printerPorts, setPrinterPorts] = useState<Array<{ path: string; manufacturer?: string }>>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(true);
  // Auto-update state
  const [updateStatus, setUpdateStatus] = useState<{status: string; message: string; percent?: number} | null>(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
      // Listen for real-time update events from Electron main process
      const unsubscribe = window.electronAPI.onUpdateStatus((data) => {
        setUpdateStatus(data);
      });
      return () => { unsubscribe(); };
    }
    // Load current admin credentials (username only)
    fetch('/api/users')
      .then(r => r.json())
      .then(users => {
        if (Array.isArray(users) && users.length > 0) {
          const admin = users.find((u: any) => u.role === 'admin') || users[0];
          setCredUsername(admin.username || '');
        }
        setLoadingCreds(false);
      })
      .catch(() => setLoadingCreds(false));
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
    if (!window.electronAPI) {
      toast.error(lang === 'ur' ? 'یہ فیچر صرف ڈیسک ٹاپ ایپ میں کام کرتا ہے' : 'This feature only works in the desktop app');
      return;
    }
    setCheckingUpdate(true);
    setUpdateStatus({ status: 'checking', message: lang === 'ur' ? 'چیک ہو رہا ہے...' : 'Checking for updates...' });
    // Send IPC to Electron main process to check for updates
    window.electronAPI.checkForUpdates();
    // Reset checking state after 30s timeout (in case no response)
    setTimeout(() => { setCheckingUpdate(false); }, 30000);
  };

  const handleInstallUpdate = () => {
    if (!window.electronAPI) return;
    window.electronAPI.installUpdate();
  };

  const update = (k: string, v: any) => setSettings(s => s ? { ...s, [k]: v } : s);

  const handleDetectPrinter = async () => {
    try {
      if (window.electronAPI) {
        const ports = await window.electronAPI.printerListPorts();
        setPrinterPorts(ports);
        if (ports.length > 0) {
          const detected = await window.electronAPI.printerAutoDetect();
          if (detected) {
            setSelectedPort(detected);
            update('defaultPrinter', detected);
            toast.success(lang === 'ur' ? `پرنٹر مل گیا: ${detected}` : `Printer found: ${detected}`);
          }
        } else {
          toast.error(lang === 'ur' ? 'کوئی پرنٹر نہیں ملا' : 'No printer found');
        }
      } else {
        toast.error(lang === 'ur' ? 'پرنٹر صرف ڈیسک ٹاپ ایپ میں کام کرتا ہے' : 'Printer only works in desktop app');
      }
    } catch (e: any) {
      toast.error(e.message || 'Printer error');
    }
  };

  const handleTestPrint = async () => {
    if (!selectedPort) { toast.error(lang === 'ur' ? 'پہلے پرنٹر منتخب کریں' : 'Select a printer first'); return; }
    setTestingPrinter(true);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.printerTest(selectedPort);
        if (result.success) toast.success(lang === 'ur' ? 'ٹیسٹ پرنٹ کامیاب!' : 'Test print successful!');
        else toast.error(result.message);
      }
    } catch (e: any) {
      toast.error(e.message || 'Print error');
    } finally { setTestingPrinter(false); }
  };

  const handleSaveCreds = async () => {
    if (!credUsername.trim()) {
      toast.error(lang === 'ur' ? 'یوزر نیم ضروری ہے' : 'Username is required');
      return;
    }
    if (credPassword && credPassword !== credConfirmPassword) {
      toast.error(t('myset.passwords_no_match', lang));
      return;
    }
    setSavingCreds(true);
    try {
      // Find admin user
      const usersRes = await fetch('/api/users');
      const users = await usersRes.json();
      const admin = Array.isArray(users) ? (users.find((u: any) => u.role === 'admin') || users[0]) : null;
      if (!admin) {
        toast.error(lang === 'ur' ? 'ایڈمن یوزر نہیں ملا' : 'Admin user not found');
        return;
      }
      const updateData: any = { id: admin.id, username: credUsername.trim() };
      if (credPassword) updateData.password = credPassword;
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      toast.success(lang === 'ur' ? 'لاگ ان معلومات محفوظ ہو گئی' : 'Login credentials saved');
      setCredPassword('');
      setCredConfirmPassword('');
      // Update current session user
      const { user } = useAppStore.getState();
      if (user) {
        useAppStore.getState().setAuth({ ...user, username: credUsername.trim() }, useAppStore.getState().token || '');
      }
    } catch {
      toast.error(lang === 'ur' ? 'محفوظ نہیں ہو سکا' : 'Failed to save');
    } finally {
      setSavingCreds(false);
    }
  };

  if (!settings) return <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">{t('set.title', lang)}</h2>

      {/* Login & Security Settings */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className={cn("text-lg flex items-center gap-2", isDark && 'text-white')}>
            <Shield className="h-5 w-5 text-emerald-500" /> {lang === 'ur' ? 'لاگ ان سیکیورٹی' : 'Login & Security'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {lang === 'ur'
              ? 'یہاں سے ایڈمن یوزر نیم اور پاسورڈ سیٹ یا تبدیل کریں۔' 
              : 'Set or change the admin username and password here.'}
          </p>
          <div>
            <Label>{t('login.username', lang)}</Label>
            <Input value={credUsername} onChange={e => setCredUsername(e.target.value)} placeholder="admin" disabled={loadingCreds} />
          </div>
          <div>
            <Label>{lang === 'ur' ? 'نیا پاسورڈ' : 'New Password'}</Label>
            <div className="relative">
              <Input
                type={showCredPassword ? 'text' : 'password'}
                value={credPassword}
                onChange={e => setCredPassword(e.target.value)}
                placeholder={lang === 'ur' ? 'تبدیل نہیں کرنا تو خالی چھوڑیں' : 'Leave empty to keep current'}
                disabled={loadingCreds}
              />
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9"
                onClick={() => setShowCredPassword(!showCredPassword)}
              >
                {showCredPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label>{lang === 'ur' ? 'پاسورڈ دوبارہ' : 'Confirm Password'}</Label>
            <Input
              type={showCredPassword ? 'text' : 'password'}
              value={credConfirmPassword}
              onChange={e => setCredConfirmPassword(e.target.value)}
              placeholder={lang === 'ur' ? 'نیا پاسورڈ دوبارہ لکھیں' : 'Re-enter new password'}
              disabled={loadingCreds}
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={handleSaveCreds} disabled={savingCreds || loadingCreds}>
            <Save className="h-4 w-4" /> {savingCreds ? (lang === 'ur' ? 'محفوظ ہو رہا ہے...' : 'Saving...') : (lang === 'ur' ? 'لاگ ان معلومات محفوظ' : 'Save Credentials')}
          </Button>
        </CardContent>
      </Card>

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

      {/* Printer Settings - 58mm Thermal */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className={cn("text-lg flex items-center gap-2", isDark && 'text-white')}>
            <Printer className="h-5 w-5 text-orange-500" /> {lang === 'ur' ? 'تھرمل پرنٹر (58mm)' : 'Thermal Printer (58mm)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {lang === 'ur' ? 'Bluetooth تھرمل پرنٹر خود بخود تلاش کریں' : 'Auto-detect Bluetooth thermal printer via COM port'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleDetectPrinter}>
              <Search className="h-4 w-4" /> {lang === 'ur' ? 'پرنٹر تلاش کریں' : 'Detect Printer'}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleTestPrint} disabled={!selectedPort || testingPrinter}>
              <TestTube2 className="h-4 w-4" /> {testingPrinter ? '...' : (lang === 'ur' ? 'ٹیسٹ پرنٹ' : 'Test Print')}
            </Button>
          </div>
          {printerPorts.length > 0 && (
            <div className="space-y-2">
              <Label>{lang === 'ur' ? 'COM پورٹ' : 'COM Port'}</Label>
              <Select value={selectedPort} onValueChange={v => { setSelectedPort(v); update('defaultPrinter', v); }}>
                <SelectTrigger><SelectValue placeholder={lang === 'ur' ? 'پورٹ منتخب کریں' : 'Select port'} /></SelectTrigger>
                <SelectContent>
                  {printerPorts.map(p => (
                    <SelectItem key={p.path} value={p.path}>
                      {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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

      {/* Auto Update - Real Electron auto-updater */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader>
          <CardTitle className={cn("text-lg flex items-center gap-2", isDark && 'text-white')}>
            <RefreshCw className="h-5 w-5 text-emerald-500" /> {lang === 'ur' ? 'آٹو اپڈیٹ' : 'Auto Update'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {lang === 'ur'
              ? 'نئی ورژن آتی ہے تو یہ خود بخود ڈاؤن لوڈ ہو جائے گی اور ایپ بند ہونے پر انسٹال ہوگی۔ ڈیلٹا اپڈیٹ سپورٹ ہے - صرف تبدیلیاں ڈاؤن لوڈ ہوتی ہیں۔'
              : 'New versions are downloaded automatically (delta updates). The app installs updates on quit.'}
          </p>

          {/* Current version badge */}
          <div className="flex items-center gap-3">
            <div className={cn("px-3 py-1.5 rounded-lg text-sm font-mono font-bold", isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700')}>
              v{appVersion || '---'}
            </div>
            <span className="text-xs text-muted-foreground">
              {lang === 'ur' ? 'موجودہ ورژن' : 'Current Version'}
            </span>
          </div>

          {/* Update status display */}
          {updateStatus && (
            <div className={cn("rounded-lg p-3 border",
              updateStatus.status === 'error' ? (isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200') :
              updateStatus.status === 'downloaded' ? (isDark ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200') :
              updateStatus.status === 'downloading' ? (isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200') :
              (isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200')
            )}>
              <div className="flex items-center gap-2">
                {updateStatus.status === 'checking' && <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />}
                {updateStatus.status === 'available' && <Download className="h-4 w-4 text-blue-500" />}
                {updateStatus.status === 'downloading' && <Download className="h-4 w-4 text-blue-500 animate-pulse" />}
                {updateStatus.status === 'downloaded' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {updateStatus.status === 'not-available' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {updateStatus.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                <p className="text-sm font-medium">{updateStatus.message}</p>
              </div>
              {/* Progress bar for downloading */}
              {updateStatus.status === 'downloading' && updateStatus.percent !== undefined && (
                <div className="mt-2">
                  <div className={cn("w-full h-3 rounded-full overflow-hidden", isDark ? 'bg-slate-600' : 'bg-slate-200')}>
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${updateStatus.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">{updateStatus.percent}%</p>
                </div>
              )}
              {/* Install button when downloaded */}
              {updateStatus.status === 'downloaded' && (
                <Button className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={handleInstallUpdate}>
                  <RotateCcw className="h-4 w-4" /> {lang === 'ur' ? 'ابھی ری اسٹارٹ کریں اور انسٹال کریں' : 'Restart Now & Install'}
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={handleCheckUpdate} disabled={checkingUpdate || updateStatus?.status === 'downloading'}>
              <RefreshCw className={cn("h-4 w-4", (checkingUpdate || updateStatus?.status === 'checking') && "animate-spin")} />
              {checkingUpdate || updateStatus?.status === 'checking'
                ? (lang === 'ur' ? 'چیک ہو رہا ہے...' : 'Checking...')
                : (lang === 'ur' ? 'اپڈیٹ چیک کریں' : 'Check for Updates')}
            </Button>
          </div>

          {!window.electronAPI && (
            <p className="text-xs text-amber-500">{lang === 'ur' ? 'آٹو اپڈیٹ صرف ڈیسک ٹاپ ایپ میں کام کرتا ہے' : 'Auto-update only works in the desktop app'}</p>
          )}
        </CardContent>
      </Card>

      <Button className="bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? t('set.saving', lang) : t('set.save_settings', lang)}
      </Button>
    </div>
  );
}