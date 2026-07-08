import { create } from 'zustand';

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  permissions: Record<string, boolean>;
  isActive: boolean;
}

export interface Notification {
  id: string;
  type: 'low_stock' | 'update' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface AppState {
  // Auth
  user: AppUser | null;
  token: string | null;
  setAuth: (user: any, token: string) => void;
  logout: () => void;

  // Language
  lang: 'en' | 'ur';
  setLang: (lang: 'en' | 'ur') => void;
  toggleLang: () => void;

  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  clearNotifications: () => void;
  markAllRead: () => void;

  // Permissions
  hasPermission: (page: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    let perms: Record<string, boolean> = {};
    try { perms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { perms = {}; }
    const appUser: AppUser = { ...user, permissions: perms };
    set({ user: appUser, token });
  },
  logout: () => set({ user: null, token: null }),

  lang: (typeof window !== 'undefined' ? localStorage.getItem('pos-lang') as 'en' | 'ur' : null) || 'en',
  setLang: (lang) => { localStorage.setItem('pos-lang', lang); set({ lang }); },
  toggleLang: () => set((s) => {
    const next = s.lang === 'en' ? 'ur' : 'en';
    localStorage.setItem('pos-lang', next);
    document.documentElement.dir = next === 'ur' ? 'rtl' : 'ltr';
    return { lang: next };
  }),

  theme: (typeof window !== 'undefined' && localStorage.getItem('pos-theme') as 'light' | 'dark') || 'light',
  setTheme: (theme) => { localStorage.setItem('pos-theme', theme); set({ theme }); },
  toggleTheme: () => set((s) => {
    const next = s.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('pos-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    return { theme: next };
  }),

  notifications: [],
  addNotification: (n) => set((s) => ({
    notifications: [{ ...n, id: Date.now().toString(), read: false, createdAt: new Date().toISOString() }, ...s.notifications],
  })),
  clearNotifications: () => set({ notifications: [] }),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) })),

  hasPermission: (page) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'admin') return true;
    // If no permissions set, allow everything for non-admin (backward compat)
    if (!user.permissions || Object.keys(user.permissions).length === 0) return true;
    return user.permissions[page] === true;
  },
}));