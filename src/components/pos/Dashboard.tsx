'use client';

import { useEffect, useState } from 'react';
import { DollarSign, ShoppingCart, Package, Users, AlertTriangle, TrendingUp, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStats {
  todaySales: number;
  todayPurchases: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: { id: string; name: string; stock: number; minStock: number }[];
  recentSales: { id: string; invoiceNo: string; total: number; createdAt: string; saleType: string; customerName?: string }[];
  totalExpenses: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setStats);
  }, []);

  if (!stats) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  const cards = [
    { title: 'آج کی فروخت', titleEn: 'Today Sales', value: stats.todaySales, icon: <DollarSign className="h-6 w-6" />, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'آج کی خریداری', titleEn: 'Today Purchases', value: stats.todayPurchases, icon: <Truck className="h-6 w-6" />, color: 'text-blue-600 bg-blue-50' },
    { title: 'کل پراڈکٹس', titleEn: 'Total Products', value: stats.totalProducts, icon: <Package className="h-6 w-6" />, color: 'text-purple-600 bg-purple-50' },
    { title: 'کل کسٹمرز', titleEn: 'Total Customers', value: stats.totalCustomers, icon: <Users className="h-6 w-6" />, color: 'text-orange-600 bg-orange-50' },
    { title: 'آج کے اخراجات', titleEn: 'Today Expenses', value: stats.totalExpenses, icon: <TrendingUp className="h-6 w-6" />, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ڈیش بورڈ</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <Card key={card.titleEn}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">Rs {card.value.toLocaleString()}</p>
                </div>
                <div className={`p-3 rounded-xl ${card.color}`}>
                  {card.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              کم اسٹاک وارننگ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">تمام پراڈکٹس کا اسٹاک ٹھیک ہے</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {stats.lowStockProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-amber-700 font-mono">{p.stock} / {p.minStock}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-emerald-500" />
              حالیہ فروخت
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentSales.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">ابھی کوئی فروخت نہیں</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {stats.recentSales.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{s.invoiceNo}</p>
                      {s.customerName && <p className="text-xs text-muted-foreground">{s.customerName}</p>}
                    </div>
                    <span className="text-sm font-bold text-emerald-600">Rs {s.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}