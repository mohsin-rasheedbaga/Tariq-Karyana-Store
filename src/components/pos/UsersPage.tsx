'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, UserCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

interface User { id: string; username: string; fullName: string; role: string; isActive: boolean; lastLogin?: string; createdAt: string; }

export function UsersPage() {
  const { lang, user: currentUser } = useAppStore();
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'cashier' });

  const loadUsers = async () => {
    const res = await fetch('/api/users');
    setUsers(Array.isArray(await res.json()) ? users : []);
  };

  useEffect(() => { void loadUsers(); }, []);

  const handleSave = async () => {
    if (!form.username || !form.fullName) return;
    if (editing) {
      await fetch('/api/users', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...form, password: form.password || undefined }),
      });
      toast.success('Updated');
    } else {
      if (!form.password) { toast.error('Password required'); return; }
      await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      toast.success('User created');
    }
    setOpen(false); setEditing(null); setForm({ username: '', password: '', fullName: '', role: 'cashier' });
    void loadUsers();
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) { toast.error('Cannot delete yourself'); return; }
    if (!confirm(t('user.confirm_delete', lang))) return;
    await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    void loadUsers();
  };

  const toggleActive = async (u: User) => {
    await fetch('/api/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
    });
    void loadUsers();
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-3.5 w-3.5" />;
      case 'cashier': return <UserCheck className="h-3.5 w-3.5" />;
      default: return <Eye className="h-3.5 w-3.5" />;
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      cashier: 'bg-emerald-100 text-emerald-700',
      viewer: 'bg-blue-100 text-blue-700',
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('user.title', lang)}</h2>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm({ username: '', password: '', fullName: '', role: 'cashier' }); }}}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" /> {t('user.new', lang)}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editing ? t('user.edit', lang) : t('user.new', lang)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label>{t('user.username', lang)}</Label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editing} /></div>
              <div><Label>{t('user.full_name', lang)}</Label><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
              <div><Label>{t('user.password', lang)}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editing ? '(leave empty to keep)' : ''} /></div>
              <div>
                <Label>{t('user.role', lang)}</Label>
                <div className="flex gap-2 mt-1">
                  {(['admin', 'cashier', 'viewer'] as const).map(r => (
                    <Button key={r} variant={form.role === r ? 'default' : 'outline'} size="sm" onClick={() => setForm(f => ({ ...f, role: r }))} className={form.role === r ? 'bg-emerald-600' : ''}>
                      {roleIcon(r)} {t(`user.${r}`, lang)}
                    </Button>
                  ))}
                </div>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={!form.username || !form.fullName}>
                {t('common.save', lang)}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.length === 0 ? (
          <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground">{t('user.no_users', lang)}</CardContent></Card>
        ) : users.map(u => (
          <Card key={u.id} className={`hover:shadow-md transition-shadow ${!u.isActive ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${u.role === 'admin' ? 'bg-red-500' : u.role === 'cashier' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                    {u.fullName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold">{u.fullName}</h3>
                    <p className="text-sm text-muted-foreground">@{u.username}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${roleBadge(u.role)}`}>
                  {roleIcon(u.role)} {t(`user.${u.role}`, lang)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="text-xs text-muted-foreground">
                  {u.lastLogin ? `${t('user.last_login', lang)}: ${new Date(u.lastLogin).toLocaleDateString()}` : 'Never logged in'}
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={u.isActive} onCheckedChange={() => toggleActive(u)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(u); setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role }); setOpen(true); }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  {u.id !== currentUser?.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}