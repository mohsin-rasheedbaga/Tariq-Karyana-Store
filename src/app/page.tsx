'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function Home() {
  const { user, lang, theme, token, hasPermission, setAuth } = useAppStore();
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
    // Initialize DB and auto-login: get auth directly from server
    // No login page — app opens directly to dashboard
    fetch('/api/auth/auto-login', { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.user && data.token) {
          setAuth(data.user, data.token);
        }
        setDbReady(true);
      })
      .catch(() => {
        // Even if auto-login fails, try to restore from localStorage
        const savedUser = localStorage.getItem('pos-user');
        const savedToken = localStorage.getItem('pos-token');
        if (savedUser && savedToken) {
          try {
            const parsed = JSON.parse(savedUser);
            setAuth(parsed, savedToken);
          } catch { /* ignore */ }
        }
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

  // Load dashboard data after DB is ready and user is authenticated
  useEffect(() => {
    if (!user || !dbReady) return;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) return;
        const data = await res.json();
        if (data.lowStockProducts) setLowStockCount(data.lowStockProducts.length);
      } catch { /* ignore */ }
    };
    void load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user, dbReady]);

  if (!mounted || !dbReady) {
    return (
      <div className={cn(
        "flex items-center justify-center h-screen transition-colors duration-300",
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      )}>
        <div className="text-center space-y-3">
          <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">
            {lang === 'ur' ? 'سسٹم تیار ہو رہا ہے...' : 'Preparing system...'}
          </p>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  // If still no user after dbReady (shouldn't happen normally), show error
  if (!user) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-screen gap-4 transition-colors duration-300",
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      )}>
        <p className="text-red-500">{lang === 'ur' ? 'سسٹم شروع نہیں ہو سکا' : 'System failed to start'}</p>
        <button
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
          onClick={() => window.location.reload()}
        >
          {lang === 'ur' ? 'دوبارہ کوشش کریں' : 'Retry'}
        </button>
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