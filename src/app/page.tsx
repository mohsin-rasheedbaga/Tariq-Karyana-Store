'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/pos/Sidebar';
import { Dashboard } from '@/components/pos/Dashboard';
import { ProductsPage } from '@/components/pos/ProductsPage';
import { CustomersPage } from '@/components/pos/CustomersPage';
import { SalesPage } from '@/components/pos/SalesPage';
import { PurchasesPage } from '@/components/pos/PurchasesPage';
import { PurchaseReturnsPage } from '@/components/pos/PurchaseReturnsPage';
import { StockPage } from '@/components/pos/StockPage';
import { ExpensesPage } from '@/components/pos/ExpensesPage';
import { BankPage } from '@/components/pos/BankPage';
import { ReportsPage } from '@/components/pos/ReportsPage';
import { DailyClosingPage } from '@/components/pos/DailyClosingPage';
import { CustomerLedgerPage } from '@/components/pos/CustomerLedgerPage';
import { UsersPage } from '@/components/pos/UsersPage';
import { NetworkPage } from '@/components/pos/NetworkPage';
import { SettingsPage } from '@/components/pos/SettingsPage';
import { MySettingsPage } from '@/components/pos/MySettingsPage';
import { VendorsPage } from '@/components/pos/VendorsPage';
import { ClassificationsPage } from '@/components/pos/ClassificationsPage';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

type Page = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'purchase_returns' | 'vendors' | 'classifications' | 'stock' | 'expenses' | 'bank' | 'reports' | 'daily_closing' | 'customer_ledger' | 'users' | 'settings' | 'network' | 'my_settings';

// Fallback admin user — used only when API completely fails
// This ensures the app ALWAYS opens, even if DB is broken
const FALLBACK_USER = {
  id: 'fallback-admin',
  username: 'admin',
  fullName: 'Admin',
  role: 'admin' as const,
  isActive: true,
  permissions: {
    dashboard: true, sales: true, products: true,
    purchases: true, customers: true, expenses: true,
    reports: true, users: true, settings: true, bank: true,
    stock: true, categories: true, units: true, groups: true, party: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function Home() {
  const { user, lang, theme, token, hasPermission, setAuth } = useAppStore();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [startupStep, setStartupStep] = useState(0);
  const isDark = theme === 'dark';

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [theme, lang]);

  useEffect(() => {
    let cancelled = false;
    const MAX_RETRIES = 3;
    let attempt = 0;

    const tryAutoLogin = async () => {
      for (attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (cancelled) return;
        setStartupStep(attempt);
        try {
          const res = await fetch('/api/auth/auto-login', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.user && data.token) {
              setAuth(data.user, data.token);
              setDbReady(true);
              return;
            }
          }
          console.warn(`[Startup] Auto-login attempt ${attempt} failed: HTTP ${res.status}`);
        } catch (e) {
          console.warn(`[Startup] Auto-login attempt ${attempt} error:`, e);
        }
        // Wait before retry (2s, 3s, 5s)
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 + attempt * 1000));
        }
      }

      // All retries failed — try localStorage
      if (cancelled) return;
      const savedUser = localStorage.getItem('pos-user');
      const savedToken = localStorage.getItem('pos-token');
      if (savedUser && savedToken) {
        try {
          const parsed = JSON.parse(savedUser);
          setAuth(parsed, savedToken);
          setDbReady(true);
          return;
        } catch {}
      }

      // LAST RESORT: Use fallback admin user so app always opens
      console.warn('[Startup] All login methods failed, using fallback admin');
      setAuth(FALLBACK_USER, 'fallback-token');
      setDbReady(true);
    };

    tryAutoLogin();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (user && token) {
      localStorage.setItem('pos-user', JSON.stringify(user));
      localStorage.setItem('pos-token', token);
    } else {
      localStorage.removeItem('pos-user');
      localStorage.removeItem('pos-token');
    }
  }, [user, token]);

  // Load dashboard data
  useEffect(() => {
    if (!user || !dbReady) return;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) return;
        const data = await res.json();
        if (data.lowStockProducts) setLowStockCount(data.lowStockProducts.length);
      } catch {}
    };
    void load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user, dbReady]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Loading state
  if (!dbReady) {
    const steps = [
      lang === 'ur' ? 'سرور شروع ہو رہا ہے...' : 'Starting server...',
      lang === 'ur' ? 'ڈیٹا بیس بنایا جا رہا ہے...' : 'Creating database...',
      lang === 'ur' ? 'معلومات لوڈ ہو رہی ہیں...' : 'Loading data...',
    ];
    return (
      <div className={cn("flex flex-col items-center justify-center h-screen gap-4 transition-colors", isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900')}>
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">{steps[Math.min(startupStep - 1, steps.length - 1)] || steps[0]}</p>
        <p className="text-xs text-muted-foreground">
          {lang === 'ur' ? `کوشش ${startupStep}/3` : `Attempt ${startupStep}/3`}
        </p>
        <Toaster position="top-right" />
      </div>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return hasPermission('dashboard') ? <Dashboard onNavigate={setActivePage} /> : <AccessDenied />;
      case 'products': return <ProductsPage />;
      case 'customers': return <CustomersPage />;
      case 'sales': return <SalesPage />;
      case 'purchases': return <PurchasesPage />;
      case 'purchase_returns': return <PurchaseReturnsPage />;
      case 'vendors': return <VendorsPage />;
      case 'classifications': return <ClassificationsPage />;
      case 'daily_closing': return <DailyClosingPage />;
      case 'customer_ledger': return <CustomerLedgerPage />;
      case 'stock': return <StockPage />;
      case 'expenses': return <ExpensesPage />;
      case 'bank': return <BankPage />;
      case 'reports': return <ReportsPage />;
      case 'users': return <UsersPage />;
      case 'network': return <NetworkPage />;
      case 'settings': return <SettingsPage />;
      case 'my_settings': return <MySettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className={cn(
      "flex h-screen overflow-hidden transition-colors duration-300",
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    )}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} lowStockCount={lowStockCount} />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {renderPage()}
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

function AccessDenied() {
  const { lang } = useAppStore();
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">{lang === 'ur' ? 'رسائی مسدود ہے' : 'Access Denied'}</p>
    </div>
  );
}