'use client';

import { useState } from 'react';
import {
  LayoutDashboard, Package, Users, ShoppingCart, Truck, Warehouse,
  DollarSign, Settings, CreditCard, TrendingUp, AlertTriangle,
  LogOut, Languages, Sun, Moon, UserCog, Wifi, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Page = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'stock' | 'expenses' | 'bank' | 'reports' | 'users' | 'settings' | 'network';

interface NavItem {
  id: Page;
  key: string;
  icon: React.ReactNode;
  section: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', key: 'nav.dashboard', icon: <LayoutDashboard className="h-5 w-5" />, section: 'nav.main' },
  { id: 'products', key: 'nav.products', icon: <Package className="h-5 w-5" />, section: 'nav.main' },
  { id: 'customers', key: 'nav.customers', icon: <Users className="h-5 w-5" />, section: 'nav.main' },
  { id: 'purchases', key: 'nav.purchases', icon: <Truck className="h-5 w-5" />, section: 'nav.main' },
  { id: 'stock', key: 'nav.stock', icon: <Warehouse className="h-5 w-5" />, section: 'nav.inventory' },
  { id: 'expenses', key: 'nav.expenses', icon: <DollarSign className="h-5 w-5" />, section: 'nav.finance' },
  { id: 'bank', key: 'nav.bank', icon: <CreditCard className="h-5 w-5" />, section: 'nav.finance' },
  { id: 'reports', key: 'nav.reports', icon: <TrendingUp className="h-5 w-5" />, section: 'nav.finance' },
  { id: 'users', key: 'nav.users', icon: <UserCog className="h-5 w-5" />, section: 'nav.system' },
  { id: 'network', key: 'nav.network', icon: <Wifi className="h-5 w-5" />, section: 'nav.system' },
  { id: 'settings', key: 'nav.settings', icon: <Settings className="h-5 w-5" />, section: 'nav.system' },
];

const sections = [
  { key: 'nav.main' },
  { key: 'nav.inventory' },
  { key: 'nav.finance' },
  { key: 'nav.system' },
];

export function Sidebar({ activePage, onNavigate, lowStockCount }: {
  activePage: Page;
  onNavigate: (page: Page) => void;
  lowStockCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, lang, toggleLang, theme, toggleTheme } = useAppStore();
  const isDark = theme === 'dark';

  return (
    <div className={cn(
      "flex flex-col h-full transition-all duration-300 border-r",
      isDark ? 'bg-slate-900 border-slate-700' : 'bg-gradient-to-b from-slate-900 to-slate-800',
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Header */}
      <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          TS
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm leading-tight text-white">Tariq Store</h1>
            <p className="text-[10px] text-slate-400">POS System v2.0</p>
          </div>
        )}
        <Button
          variant="ghost" size="icon"
          className="ml-auto h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700 flex-shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Language + Theme Buttons */}
      <div className={cn("flex gap-1 px-2 py-2 border-b border-slate-700/50", collapsed && "justify-center")}>
        <Button
          variant="ghost" size="icon"
          className={cn("h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700", lang === 'ur' && 'text-emerald-400')}
          onClick={toggleLang} title="Language"
        >
          <Languages className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className={cn("h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700", isDark && 'text-yellow-400')}
          onClick={toggleTheme} title="Theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
                  {t(section.key, lang)}
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
                  {!collapsed && <span>{t(item.key, lang)}</span>}
                  {item.id === 'stock' && lowStockCount > 0 && !collapsed && (
                    <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 h-5">
                      {lowStockCount}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          );
        })}
      </ScrollArea>

      {/* NEW SALE BUTTON - At the very bottom before footer */}
      <div className={cn("px-2", collapsed ? "px-1" : "")}>
        <Button
          className={cn(
            "w-full h-14 text-base font-bold gap-2 rounded-xl",
            "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30",
            collapsed && "h-12 px-2"
          )}
          onClick={() => onNavigate('sales')}
        >
          <ShoppingCart className="h-6 w-6" />
          {!collapsed && t('nav.sales', lang)}
        </Button>
      </div>

      <div className="h-2" />

      {/* User + Logout */}
      <div className={cn("border-t border-slate-700/50 p-2", collapsed && "flex flex-col items-center gap-1")}>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-1 mb-1">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-emerald-600 text-white text-xs">{user.fullName[0]}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{user.fullName}</p>
              <p className="text-[10px] text-slate-400">{user.role}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-3 h-9 text-sm text-red-400 hover:text-red-300 hover:bg-slate-700", collapsed && "justify-center px-0")}
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && t('nav.logout', lang)}
        </Button>
        {!collapsed && (
          <p className="text-[10px] text-slate-500 px-2 mt-1">
            {t('nav.sync_ready', lang)}
          </p>
        )}
      </div>
    </div>
  );
}