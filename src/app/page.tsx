'use client';

import { useState, useEffect } from 'react';
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
import { SettingsPage } from '@/components/pos/SettingsPage';

type Page = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'stock' | 'expenses' | 'bank' | 'reports' | 'settings';

export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    // Fetch low stock count for sidebar badge
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(data => {
        if (data.lowStockProducts) {
          setLowStockCount(data.lowStockProducts.length);
        }
      })
      .catch(() => {});

    // Periodic refresh for low stock
    const interval = setInterval(() => {
      fetch('/api/dashboard')
        .then(r => r.json())
        .then(data => {
          if (data.lowStockProducts) setLowStockCount(data.lowStockProducts.length);
        })
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        lowStockCount={lowStockCount}
      />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50">
        {renderPage()}
      </main>
    </div>
  );
}