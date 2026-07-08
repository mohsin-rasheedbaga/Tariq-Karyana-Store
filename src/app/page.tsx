'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/pos/Sidebar';
import { LoginPage } from '@/components/pos/LoginPage';
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
import { Toaster } from '@/components/ui/sonner';

type Page = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'stock' | 'expenses' | 'bank' | 'reports' | 'users' | 'settings' | 'network';

export default function Home() {
  const { user, lang, theme, token } = useAppStore();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Apply theme and direction on mount
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  }, [theme, lang]);

  // Restore auth from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('pos-user');
    const savedToken = localStorage.getItem('pos-token');
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        useAppStore.getState().setAuth(parsed, savedToken);
      } catch { /* ignore */ }
    }
  }, []);

  // Save auth to localStorage
  useEffect(() => {
    if (user && token) {
      localStorage.setItem('pos-user', JSON.stringify(user));
      localStorage.setItem('pos-token', token);
    } else {
      localStorage.removeItem('pos-user');
      localStorage.removeItem('pos-token');
    }
  }, [user, token]);

  // Fetch low stock count
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
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!mounted) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  // Show Login if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
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
      default: return <Dashboard />;
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        lowStockCount={lowStockCount}
      />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {renderPage()}
      </main>
      <Toaster position="top-right" />
    </div>
  );
}