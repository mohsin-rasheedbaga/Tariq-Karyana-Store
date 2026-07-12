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

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [theme, lang]);

  useEffect(() => {
    const savedUser = localStorage.getItem('pos-user');
    const savedToken = localStorage.getItem('pos-token');
    if (savedUser && savedToken) {
      try { const parsed = JSON.parse(savedUser); useAppStore.getState().setAuth(parsed, savedToken); } catch { /* ignore */ }
      return;
    }
    // Auto-login: no login page, directly authenticate as admin
    fetch('/api/auth/auto-login', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.user && data.token) {
          useAppStore.getState().setAuth(data.user, data.token);
        }
      })
      .catch(err => console.error('Auto-login failed:', err));
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

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  if (!mounted) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
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

  const isDark = theme === 'dark';

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