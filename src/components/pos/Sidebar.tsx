'use client';

import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Package, Users, ShoppingCart, Truck, Warehouse,
  DollarSign, Settings, CreditCard, TrendingUp, AlertTriangle,
  LogOut, Languages, Sun, Moon, UserCog, Wifi, ChevronLeft, ChevronRight,
  Bell, UserCircle, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAppStore, Notification } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Page = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'stock' | 'expenses' | 'bank' | 'reports' | 'users' | 'settings' | 'network' | 'my_settings';

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
  { id: 'settings', key: 'nav.settings', icon: <Settings className="h-5 w-5" />, section: 'nav.system' },
  { id: 'network', key: 'nav.network', icon: <Wifi className="h-5 w-5" />, section: 'nav.system' },
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
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { user, logout, lang, toggleLang, theme, toggleTheme, notifications, markAllRead } = useAppStore();
  const isDark = theme === 'dark';
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter nav items by permission
  const visibleNavItems = navItems.filter(item => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!user.permissions || Object.keys(user.permissions).length === 0) return true;
    return user.permissions[item.id] === true;
  });

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
            <p className="text-[10px] text-slate-400">POS System v1.2.5</p>
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

      {/* Top Controls: Language + Theme + Notification */}
      <div className={cn("flex gap-1 px-2 py-2 border-b border-slate-700/50", collapsed && "justify-center flex-wrap")}>
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
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
            onClick={() => setShowNotif(!showNotif)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          {/* Notification Panel */}
          {showNotif && (
            <div className={cn(
              "absolute top-10 z-50 w-80 rounded-xl border shadow-xl overflow-hidden",
              isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
            )} style={{ left: collapsed ? '-260px' : 'auto', right: collapsed ? 'auto' : 0 }}>
              <div className="p-3 flex items-center justify-between border-b border-slate-700/50">
                <h3 className="font-bold text-sm text-white">{t('notif.title', lang)}</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-emerald-400 hover:text-emerald-300">
                    {t('notif.clear', lang)}
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-6">{t('notif.no_notif', lang)}</p>
                ) : notifications.slice(0, 10).map(n => (
                  <div key={n.id} className={cn(
                    "p-3 border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors",
                    n.read && 'opacity-50'
                  )}>
                    <div className="flex items-start gap-2">
                      {n.type === 'low_stock' && <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />}
                      {n.type === 'update' && <TrendingUp className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />}
                      {n.type === 'info' && <Bell className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />}
                      <div>
                        <p className="text-sm font-medium text-white">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        {/* NEW SALE BUTTON - Right after Dashboard */}
        <div className={cn("px-1 mb-2", collapsed && "px-0.5")}>
          <Button
            className={cn(
              "w-full h-12 text-sm font-bold gap-2 rounded-xl",
              "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
              collapsed && "h-10 px-2"
            )}
            onClick={() => onNavigate('sales')}
          >
            <ShoppingCart className="h-5 w-5" />
            {!collapsed && t('nav.new_sale', lang)}
          </Button>
        </div>

        <Separator className="mx-2 mb-2 bg-slate-700/30" />

        {sections.map(section => {
          const items = visibleNavItems.filter(n => n.section === section.key);
          if (items.length === 0) return null;
          return (
            <div key={section.key} className="mb-1">
              {!collapsed && (
                <p className="px-3 py-0.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t(section.key, lang)}
                </p>
              )}
              {items.map(item => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 h-9 px-3 mx-1 text-sm",
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

      <div className="h-2" />

      {/* User + Settings Shortcut + My Settings + Logout */}
      <div className={cn("border-t border-slate-700/50 p-2", collapsed && "flex flex-col items-center gap-1")}>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-1 mb-1">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-emerald-600 text-white text-xs">{user.fullName[0]}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">{user.fullName}</p>
              <p className="text-[10px] text-slate-400">{user.role}</p>
            </div>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => onNavigate('settings')}
              title={t('nav.settings', lang)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => onNavigate('my_settings')}
              title={t('nav.my_settings', lang)}
            >
              <UserCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
        {collapsed && user && (
          <div className="flex gap-1 mb-1">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => onNavigate('settings')}
              title={t('nav.settings', lang)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700 mb-1"
              onClick={() => onNavigate('my_settings')}
              title={t('nav.my_settings', lang)}
            >
              <UserCircle className="h-4 w-4" />
            </Button>
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