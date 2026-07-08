'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart, Sun, Moon, Languages, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth, lang, toggleLang, theme, toggleTheme } = useAppStore();

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuth(data.user, data.token);
      } else {
        setError(data.error || t('login.error', lang));
      }
    } catch {
      setError(t('login.error', lang));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-emerald-50 to-slate-100'}`}>
      {/* Top Controls */}
      <div className="fixed top-4 right-4 flex gap-2 z-50">
        <Button variant="outline" size="icon" onClick={toggleTheme} className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-yellow-400' : ''}`}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="icon" onClick={toggleLang} className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
          <Languages className="h-4 w-4" />
        </Button>
      </div>

      <Card className={`w-full max-w-md ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
        <CardContent className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-8 w-8 text-white" />
            </div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>
              {t('login.title', lang)}
            </h1>
            <p className="text-muted-foreground mt-1">{t('login.subtitle', lang)}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className={theme === 'dark' ? 'text-slate-300' : ''}>{t('login.username', lang)}</Label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                className="mt-1 h-11"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
              />
            </div>
            <div>
              <Label className={theme === 'dark' ? 'text-slate-300' : ''}>{t('login.password', lang)}</Label>
              <div className="relative mt-1">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="admin123"
                  className="h-11 pr-10"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
                <Button
                  variant="ghost" size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg font-bold"
              onClick={handleLogin}
              disabled={loading || !username || !password}
            >
              {loading ? '...' : t('login.login', lang)}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Default: admin / admin123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}