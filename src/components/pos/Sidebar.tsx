'use client';

import { useState } from 'react';
import {
  LayoutDashboard, Package, Users, ShoppingCart, Truck, Warehouse,
  DollarSign, Receipt, Settings, CreditCard, TrendingUp, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Page = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'stock' | 'expenses' | 'bank' | 'reports' | 'settings';

interface NavItem {
  id: Page;
  label: string;
  labelUr: string;
  icon: React.ReactNode;
  section: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', labelUr: 'ڈیش بورڈ', icon: <LayoutDashboard className="h-5 w-5" />, section: 'main' },
  { id: 'products', label: 'Products', labelUr: 'پراڈکٹس', icon: <Package className="h-5 w-5" />, section: 'main' },
  { id: 'customers', label: 'Customers', labelUr: 'کسٹمرز', icon: <Users className="h-5 w-5" />, section: 'main' },
  { id: 'sales', label: 'New Sale', labelUr: 'نیا سیل', icon: <ShoppingCart className="h-5 w-5" />, section: 'main' },
  { id: 'purchases', label: 'Purchases', labelUr: 'خریداری', icon: <Truck className="h-5 w-5" />, section: 'main' },
  { id: 'stock', label: 'Stock', labelUr: 'اسٹاک', icon: <Warehouse className="h-5 w-5" />, section: 'inventory' },
  { id: 'expenses', label: 'Expenses', labelUr: 'اخراجات', icon: <DollarSign className="h-5 w-5" />, section: 'finance' },
  { id: 'bank', label: 'Bank', labelUr: 'بینک', icon: <CreditCard className="h-5 w-5" />, section: 'finance' },
  { id: 'reports', label: 'Reports', labelUr: 'ریپورٹس', icon: <TrendingUp className="h-5 w-5" />, section: 'finance' },
  { id: 'settings', label: 'Settings', labelUr: 'سیٹنگز', icon: <Settings className="h-5 w-5" />, section: 'system' },
];

export function Sidebar({ activePage, onNavigate, lowStockCount }: {
  activePage: Page;
  onNavigate: (page: Page) => void;
  lowStockCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const sections = [
    { key: 'main', label: 'مرکزی' },
    { key: 'inventory', label: 'انونٹری' },
    { key: 'finance', label: 'فنانس' },
    { key: 'system', label: 'سسٹم' },
  ];

  return (
    <div className={cn(
      "bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-all duration-300 h-full",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Header */}
      <div className="p-3 border-b border-slate-700 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          TS
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm leading-tight">Tariq Store</h1>
            <p className="text-[10px] text-slate-400">POS System v2.0</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700 flex-shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        {sections.map(section => {
          const items = navItems.filter(n => n.section === section.key);
          return (
            <div key={section.key} className="mb-2">
              {!collapsed && (
                <p className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {section.label}
                </p>
              )}
              {items.map(item => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 h-10 px-3 mx-1 text-sm",
                    activePage === item.id
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  )}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.icon}
                  {!collapsed && <span>{item.labelUr}</span>}
                  {item.id === 'stock' && lowStockCount > 0 && !collapsed && (
                    <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 h-5">
                      {lowStockCount}
                    </Badge>
                  )}
                  {item.id === 'stock' && lowStockCount > 0 && collapsed && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 text-[10px] px-1 h-4 min-w-[16px]">
                      {lowStockCount}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          );
        })}
      </ScrollArea>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-700 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Local DB + Cloud Sync Ready</span>
          </div>
        </div>
      )}
    </div>
  );
}