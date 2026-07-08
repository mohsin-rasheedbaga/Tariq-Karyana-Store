import { create } from 'zustand';

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

interface AppState {
  // Auth
  user: AppUser | null;
  token: string | null;
  setAuth: (user: AppUser, token: string) => void;
  logout: () => void;

  // Language
  lang: 'en' | 'ur';
  setLang: (lang: 'en' | 'ur') => void;
  toggleLang: () => void;

  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),

  lang: (typeof window !== 'undefined' && localStorage.getItem('pos-lang') as 'en' | 'ur') || 'ur',
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
}));