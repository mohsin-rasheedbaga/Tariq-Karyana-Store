'use client';

import { useEffect, useState } from 'react';
import { DollarSign, ShoppingCart, Package, Users, AlertTriangle, TrendingUp, Truck, Plus, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface DashboardStats {
  todaySales: number;
  todayPurchases: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: { id: string; name: string; stock: number; minStock: number }[];
  recentSales: { id: string; invoiceNo: string; total: number; createdAt: string; saleType: string; customerName?: string }[];
  totalExpenses: number;
  totalStockValue: number;
  todayProfit: number;
}

export function Dashboard() {
  const { lang, theme, addNotification } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const isDark = theme === 'dark';

  const notifiedRef = new Set<string>();

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(data => {
      setStats(data);
      // Add low stock notifications (deduplicated)
      if (data.lowStockProducts?.length > 0) {
        data.lowStockProducts.slice(0, 3).forEach((p: any) => {
          if (!notifiedRef.has(p.id)) {
            notifiedRef.add(p.id);
            addNotification({
              type: 'low_stock',
              title: t('notif.low_stock', lang),
              message: `${p.name} ${t('notif.low_stock_msg', lang)} (${p.stock}/${p.minStock})`,
            });
          }
        });
      }
    });
  }, [lang]);

  if (!stats) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  const cards = [
    { title: t('dash.today_sales', lang), value: stats.todaySales, icon: <DollarSign className="h-6 w-6" />, color: 'text-emerald-600', bg: isDark ? 'bg-emerald-900/40' : 'bg-emerald-50' },
    { title: t('dash.today_purchases', lang), value: stats.todayPurchases, icon: <Truck className="h-6 w-6" />, color: 'text-blue-600', bg: isDark ? 'bg-blue-900/40' : 'bg-blue-50' },
    { title: t('dash.total_products', lang), value: stats.totalProducts, icon: <Package className="h-6 w-6" />, color: 'text-purple-600', bg: isDark ? 'bg-purple-900/40' : 'bg-purple-50' },
    { title: t('dash.total_customers', lang), value: stats.totalCustomers, icon: <Users className="h-6 w-6" />, color: 'text-orange-600', bg: isDark ? 'bg-orange-900/40' : 'bg-orange-50' },
    { title: t('dash.today_expenses', lang), value: stats.totalExpenses, icon: <TrendingUp className="h-6 w-6" />, color: 'text-red-600', bg: isDark ? 'bg-red-900/40' : 'bg-red-50' },
  ];

  const summaryCards = [
    { title: t('dash.total_stock_value', lang), value: stats.totalStockValue || 0, color: 'text-amber-600' },
    { title: t('dash.profit_today', lang), value: stats.todayProfit || 0, color: 'text-emerald-600' },
    { title: t('dash.net_sales', lang), value: stats.todaySales - (stats.totalExpenses || 0), color: 'text-blue-600' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('dash.title', lang)}</h2>

      {/* Stats Cards - with frames and change indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card, idx) => (
          <Card key={idx} className={cn("overflow-hidden border-l-4", isDark ? 'border-slate-700 bg-slate-800' : '')} style={{ borderLeftColor: card.color.includes('emerald') ? '#10b981' : card.color.includes('blue') ? '#3b82f6' : card.color.includes('purple') ? '#9333ea' : card.color.includes('orange') ? '#f97316' : '#ef4444' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                  <p className={cn("text-2xl font-bold mt-1", card.color)}>
                    {card.title.includes(t('dash.total_products', lang)) || card.title.includes(t('dash.total_customers', lang))
                      ? card.value.toLocaleString()
                      : `${t('common.currency', lang)} ${card.value.toLocaleString()}`}
                  </p>
                </div>
                <div className={cn("p-3 rounded-xl", card.bg)}>
                  {card.icon}
                </div>
              </div>

            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card, idx) => (
          <Card key={idx} className={cn(isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
              <p className={cn("text-xl font-bold mt-1", card.color)}>
                {t('common.currency', lang)} {card.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('dash.quick_actions', lang)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <button className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105 bg-emerald-500 text-white shadow-md shadow-emerald-500/20")}>
              <Plus className="h-4 w-4" /> {t('dash.new_sale', lang)}
            </button>
            <button className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105", isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700')}>
              <Package className="h-4 w-4" /> {t('dash.add_product', lang)}
            </button>
            <button className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105", isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700')}>
              <UserPlus className="h-4 w-4" /> {t('dash.add_customer', lang)}
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('dash.low_stock_warning', lang)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">{t('dash.all_stock_ok', lang)}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {stats.lowStockProducts.map(p => (
                  <div key={p.id} className={cn("flex items-center justify-between p-3 rounded-lg", isDark ? 'bg-amber-900/20' : 'bg-amber-50')}>
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className={cn("text-xs font-mono px-2 py-0.5 rounded", p.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{p.stock} / {p.minStock}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-emerald-500" />
              {t('dash.recent_sales', lang)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentSales.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">{t('dash.no_sales', lang)}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {stats.recentSales.map(s => (
                  <div key={s.id} className={cn("flex items-center justify-between p-3 rounded-lg", isDark ? 'bg-slate-700/50' : 'bg-slate-50')}>
                    <div>
                      <p className="text-sm font-medium">{s.invoiceNo}</p>
                      {s.customerName && <p className="text-xs text-muted-foreground">{s.customerName}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{t('common.currency', lang)} {s.total.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(s.createdAt).toLocaleTimeString()}</p>
                    </div>
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