'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/pos/Sidebar';
import { Dashboard } from '@/components/pos/Dashboard';
import { ProductsPage } from '@/components/pos/ProductsPage';
import { CustomersPage } from '@/components/pos/CustomersPage';
import { SalesPage } from '@/components/pos/SalesPage';
import { PurchasesPage } from '@/components/pos/PurchasesPage';
import { StockPage } from '@/components/pos/StockPage';
import { ExpensesPage } from '@/components/pos/ExpensesPage';
import { BankPage } from '@/components/pos/BankPage';
import { ReportsPage } from '@/components/pos/ReportsPage';
import { UsersPage } from '@/components/pos/UsersPage';
import { NetworkPage } from '@/components/pos/NetworkPage';
import { SettingsPage } from '@/components/pos/SettingsPage';
import { MySettingsPage } from '@/components/pos/MySettingsPage';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

type Page = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'stock' | 'expenses' | 'bank' | 'reports' | 'users' | 'settings' | 'network' | 'my_settings';

export default function Home() {
  const { user, lang, theme, token, hasPermission } = useAppStore();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [theme, lang]);

  useEffect(() => {
    // Try localStorage first
    const savedUser = localStorage.getItem('pos-user');
    const savedToken = localStorage.getItem('pos-token');
    if (savedUser && savedToken) {
      try { const parsed = JSON.parse(savedUser); useAppStore.getState().setAuth(parsed, savedToken); } catch { /* ignore */ }
    }
    // Direct admin login - no API call, app opens instantly
    const adminPerms = {
      dashboard: true, sales: true, products: true,
      purchases: true, customers: true, expenses: true,
      reports: true, users: true, settings: true, bank: true,
      stock: true, categories: true, units: true, groups: true, party: true,
    };
    useAppStore.getState().setAuth({
      id: 'local-admin',
      username: 'admin',
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
      permissions: adminPerms,
    }, 'local');

    // CRITICAL: Wait for auto-login (schema creation + seed) BEFORE any dashboard fetch
    fetch('/api/auth/auto-login', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        // Update user from DB if available
        if (data.user) {
          useAppStore.getState().setAuth(data.user, data.token || 'local');
        }
        setDbReady(true);
      })
      .catch(() => {
        // Even if auto-login fails, mark dbReady so dashboard can try
        setDbReady(true);
      });
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

  // Only load dashboard data AFTER auto-login completes
  useEffect(() => {
    if (!user || !dbReady) return;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        if (data.lowStockProducts) setLowStockCount(data.lowStockProducts.length);
      } catch { /* ignore */ }
    };
    void load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user, dbReady]);

  if (!mounted) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  // Show preparing state until DB is ready
  if (!dbReady) {
    return (
      <div className={cn(
        "flex h-screen overflow-hidden transition-colors duration-300",
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      )}>
        <Sidebar activePage={activePage} onNavigate={setActivePage} lowStockCount={0} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">
              {lang === 'ur' ? 'ڈیٹا بیس تیار ہو رہا ہے...' : 'Preparing database...'}
            </p>
          </div>
        </main>
        <Toaster position="top-right" />
      </div>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return hasPermission('dashboard') ? <Dashboard /> : <AccessDenied />;
      case 'products': return <ProductsPage />;
      case 'customers': return <CustomersPage />;
      case 'sales': return <SalesPage />;
      case 'purchases': return <PurchasesPage />;
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