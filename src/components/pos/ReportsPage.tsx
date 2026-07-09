'use client';

import { Receipt, ShoppingCart, Package, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function ReportsPage() {
  const { lang, theme } = useAppStore();
  const isDark = theme === 'dark';

  const reportCards = [
    {
      key: 'sales',
      icon: <ShoppingCart className="h-6 w-6" />,
      lightColor: 'text-emerald-600 bg-emerald-50',
      darkColor: 'text-emerald-400 bg-emerald-900/50',
    },
    {
      key: 'purchase',
      icon: <Receipt className="h-6 w-6" />,
      lightColor: 'text-blue-600 bg-blue-50',
      darkColor: 'text-blue-400 bg-blue-900/50',
    },
    {
      key: 'stock',
      icon: <Package className="h-6 w-6" />,
      lightColor: 'text-purple-600 bg-purple-50',
      darkColor: 'text-purple-400 bg-purple-900/50',
    },
    {
      key: 'profit',
      icon: <TrendingUp className="h-6 w-6" />,
      lightColor: 'text-amber-600 bg-amber-50',
      darkColor: 'text-amber-400 bg-amber-900/50',
    },
    {
      key: 'expense',
      icon: <DollarSign className="h-6 w-6" />,
      lightColor: 'text-red-600 bg-red-50',
      darkColor: 'text-red-400 bg-red-900/50',
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('rpt.title', lang)}</h2>
      <p className="text-muted-foreground">{t('rpt.coming_soon', lang)}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map(r => (
          <Card key={r.key} className={cn("hover:shadow-md transition-shadow", isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={cn("p-3 rounded-xl", isDark ? r.darkColor : r.lightColor)}>{r.icon}</div>
                <div>
                  <h3 className="font-bold text-lg">{t(`rpt.${r.key}_report`, lang)}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t(`rpt.${r.key}_desc`, lang)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}