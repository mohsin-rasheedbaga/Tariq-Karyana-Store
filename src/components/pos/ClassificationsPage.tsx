'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CategoryItem {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  products?: { id: string }[];
  _count?: { products: number };
}

interface GroupItem {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  _count?: { products: number };
}

interface UnitItem {
  id: string;
  name: string;
  shortName?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { products: number };
}

export function ClassificationsPage() {
  const { lang, theme, hasPermission } = useAppStore();
  const isDark = theme === 'dark';

  // --- Categories State ---
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<CategoryItem | null>(null);
  const [catForm, setCatForm] = useState('');

  // --- Groups State ---
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [grpSearch, setGrpSearch] = useState('');
  const [grpOpen, setGrpOpen] = useState(false);
  const [grpEditing, setGrpEditing] = useState<GroupItem | null>(null);
  const [grpForm, setGrpForm] = useState('');

  // --- Units State ---
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [unitSearch, setUnitSearch] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitEditing, setUnitEditing] = useState<UnitItem | null>(null);
  const [unitForm, setUnitForm] = useState({ name: '', shortName: '' });

  const [loading, setLoading] = useState(false);

  // --- Data Loading ---
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data.map((c: CategoryItem) => ({
        ...c,
        _count: { products: c.products?.length || 0 },
      })) : []);
    } catch { setCategories([]); }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch { setGroups([]); }
  }, []);

  const loadUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/units');
      const data = await res.json();
      setUnits(Array.isArray(data) ? data : []);
    } catch { setUnits([]); }
  }, []);

  useEffect(() => { loadCategories(); loadGroups(); loadUnits(); }, [loadCategories, loadGroups, loadUnits]);

  // --- Categories Handlers ---
  const filteredCats = categories.filter(c => !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase()));

  const handleCatSave = async () => {
    if (!catForm.trim()) return;
    setLoading(true);
    try {
      if (catEditing) {
        const res = await fetch(`/api/categories/${catEditing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catForm }),
        });
        if (!res.ok) { toast.error('Error'); return; }
      } else {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catForm }),
        });
      }
      toast.success(t('cls.saved', lang));
      setCatOpen(false); setCatEditing(null); setCatForm('');
      loadCategories();
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const handleCatEdit = (c: CategoryItem) => {
    setCatEditing(c); setCatForm(c.name); setCatOpen(true);
  };

  const handleCatDelete = async (c: CategoryItem) => {
    if (!confirm(t('cls.confirm_delete', lang))) return;
    try {
      const res = await fetch(`/api/categories/${c.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(t('cls.cannot_delete', lang)); return; }
      toast.success(t('cls.deleted', lang));
      loadCategories();
    } catch { toast.error('Error'); }
  };

  // --- Groups Handlers ---
  const filteredGrps = groups.filter(g => !grpSearch || g.name.toLowerCase().includes(grpSearch.toLowerCase()));

  const handleGrpSave = async () => {
    if (!grpForm.trim()) return;
    setLoading(true);
    try {
      if (grpEditing) {
        const res = await fetch(`/api/groups/${grpEditing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: grpForm }),
        });
        if (!res.ok) { toast.error('Error'); return; }
      } else {
        await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: grpForm }),
        });
      }
      toast.success(t('cls.saved', lang));
      setGrpOpen(false); setGrpEditing(null); setGrpForm('');
      loadGroups();
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const handleGrpEdit = (g: GroupItem) => {
    setGrpEditing(g); setGrpForm(g.name); setGrpOpen(true);
  };

  const handleGrpDelete = async (g: GroupItem) => {
    if (!confirm(t('cls.confirm_delete', lang))) return;
    try {
      const res = await fetch(`/api/groups/${g.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(t('cls.cannot_delete', lang)); return; }
      toast.success(t('cls.deleted', lang));
      loadGroups();
    } catch { toast.error('Error'); }
  };

  // --- Units Handlers ---
  const filteredUnits = units.filter(u => !unitSearch || u.name.toLowerCase().includes(unitSearch.toLowerCase()));

  const handleUnitSave = async () => {
    if (!unitForm.name.trim()) return;
    setLoading(true);
    try {
      if (unitEditing) {
        const res = await fetch(`/api/units/${unitEditing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: unitForm.name, shortName: unitForm.shortName || null }),
        });
        if (!res.ok) { toast.error('Error'); return; }
      } else {
        await fetch('/api/units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: unitForm.name, shortName: unitForm.shortName || null }),
        });
      }
      toast.success(t('cls.saved', lang));
      setUnitOpen(false); setUnitEditing(null); setUnitForm({ name: '', shortName: '' });
      loadUnits();
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const handleUnitEdit = (u: UnitItem) => {
    setUnitEditing(u); setUnitForm({ name: u.name, shortName: u.shortName || '' }); setUnitOpen(true);
  };

  const handleUnitDelete = async (u: UnitItem) => {
    if (!confirm(t('cls.confirm_delete', lang))) return;
    try {
      const res = await fetch(`/api/units/${u.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(t('cls.cannot_delete', lang)); return; }
      toast.success(t('cls.deleted', lang));
      loadUnits();
    } catch { toast.error('Error'); }
  };

  // --- Shared Table Component ---
  const renderTable = (
    items: { id: string; isActive: boolean; _count?: { products: number } }[],
    columns: { label: string; render: (item: any) => React.ReactNode }[],
    onEdit: (item: any) => void,
    onDelete: (item: any) => void,
    noItemsKey: string,
  ) => (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={cn('border-b', isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50')}>
            {columns.map((col, i) => (
              <th key={i} className={cn('p-3', i === 0 ? 'text-left' : i === columns.length - 1 ? 'text-right' : 'text-left')}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                {t(noItemsKey, lang)}
              </td>
            </tr>
          ) : items.map(item => (
            <tr
              key={item.id}
              className={cn(
                'border-b transition-colors',
                isDark ? 'border-slate-700 hover:bg-slate-700/60' : 'hover:bg-slate-50'
              )}
            >
              {columns.map((col, i) => (
                <td key={i} className={cn('p-3', i === columns.length - 1 ? 'text-right' : '')}>
                  {col.render(item)}
                </td>
              ))}
              <td className="p-3 text-right">
                <div className="flex justify-end gap-1">
                  {hasPermission('products') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {hasPermission('products') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('cls.title', lang)}</h2>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className={cn(isDark && 'bg-slate-800')}>
          <TabsTrigger value="categories">{t('cls.categories', lang)}</TabsTrigger>
          <TabsTrigger value="groups">{t('cls.groups', lang)}</TabsTrigger>
          <TabsTrigger value="units">{t('cls.units', lang)}</TabsTrigger>
        </TabsList>

        {/* ===== CATEGORIES TAB ===== */}
        <TabsContent value="categories" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder={t('cls.search', lang)}
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
              />
              {catSearch && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setCatSearch('')}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {hasPermission('products') && (
              <Dialog open={catOpen} onOpenChange={o => { setCatOpen(o); if (!o) { setCatEditing(null); setCatForm(''); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" /> {t('cls.add_category', lang)}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{catEditing ? t('cls.edit_category', lang) : t('cls.add_category', lang)}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label>{t('cls.name', lang)} *</Label>
                      <Input
                        value={catForm}
                        onChange={e => setCatForm(e.target.value)}
                        placeholder={t('cls.name_placeholder', lang)}
                        className={cn(isDark && 'bg-slate-800 border-slate-600')}
                        autoFocus
                      />
                    </div>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleCatSave}
                      disabled={loading || !catForm.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" /> {t('common.save', lang)}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-0">
              {renderTable(
                filteredCats,
                [
                  { label: t('cls.name', lang), render: (c) => <span className="font-medium">{c.name}</span> },
                  { label: t('cls.sub_categories', lang), render: (c) => <span className="text-muted-foreground">{(c as CategoryItem).products?.length || 0}</span> },
                  { label: t('cls.status', lang), render: (c) => (
                    <Badge className={c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                      {c.isActive ? t('cls.active', lang) : t('cls.inactive', lang)}
                    </Badge>
                  )},
                ],
                handleCatEdit,
                handleCatDelete,
                'cls.no_items',
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== GROUPS TAB ===== */}
        <TabsContent value="groups" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder={t('cls.search', lang)}
                value={grpSearch}
                onChange={e => setGrpSearch(e.target.value)}
              />
              {grpSearch && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setGrpSearch('')}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {hasPermission('products') && (
              <Dialog open={grpOpen} onOpenChange={o => { setGrpOpen(o); if (!o) { setGrpEditing(null); setGrpForm(''); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" /> {t('cls.add_group', lang)}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{grpEditing ? t('cls.edit_group', lang) : t('cls.add_group', lang)}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label>{t('cls.name', lang)} *</Label>
                      <Input
                        value={grpForm}
                        onChange={e => setGrpForm(e.target.value)}
                        placeholder={t('cls.name_placeholder', lang)}
                        className={cn(isDark && 'bg-slate-800 border-slate-600')}
                        autoFocus
                      />
                    </div>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleGrpSave}
                      disabled={loading || !grpForm.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" /> {t('common.save', lang)}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-0">
              {renderTable(
                filteredGrps,
                [
                  { label: t('cls.name', lang), render: (g) => <span className="font-medium">{g.name}</span> },
                  { label: t('cls.products', lang), render: (g) => <span className="text-muted-foreground">{g._count?.products || 0}</span> },
                  { label: t('cls.status', lang), render: (g) => (
                    <Badge className={g.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                      {g.isActive ? t('cls.active', lang) : t('cls.inactive', lang)}
                    </Badge>
                  )},
                ],
                handleGrpEdit,
                handleGrpDelete,
                'cls.no_items',
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== UNITS TAB ===== */}
        <TabsContent value="units" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder={t('cls.search', lang)}
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
              />
              {unitSearch && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setUnitSearch('')}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {hasPermission('products') && (
              <Dialog open={unitOpen} onOpenChange={o => { setUnitOpen(o); if (!o) { setUnitEditing(null); setUnitForm({ name: '', shortName: '' }); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" /> {t('cls.add_unit', lang)}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{unitEditing ? t('cls.edit_unit', lang) : t('cls.add_unit', lang)}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label>{t('cls.name', lang)} *</Label>
                      <Input
                        value={unitForm.name}
                        onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))}
                        placeholder={t('cls.name_placeholder', lang)}
                        className={cn(isDark && 'bg-slate-800 border-slate-600')}
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label>{t('cls.short_name', lang)}</Label>
                      <Input
                        value={unitForm.shortName}
                        onChange={e => setUnitForm(f => ({ ...f, shortName: e.target.value }))}
                        placeholder={t('cls.short_name_placeholder', lang)}
                        className={cn(isDark && 'bg-slate-800 border-slate-600')}
                      />
                    </div>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleUnitSave}
                      disabled={loading || !unitForm.name.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" /> {t('common.save', lang)}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card className={cn(isDark && 'bg-slate-800 border-slate-700')}>
            <CardContent className="p-0">
              {renderTable(
                filteredUnits,
                [
                  { label: t('cls.name', lang), render: (u) => <span className="font-medium">{u.name}</span> },
                  { label: t('cls.short_name', lang), render: (u) => <span className="text-muted-foreground">{u.shortName || '-'}</span> },
                  { label: t('cls.products', lang), render: (u) => <span className="text-muted-foreground">{u._count?.products || 0}</span> },
                  { label: t('cls.status', lang), render: (u) => (
                    <Badge className={u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                      {u.isActive ? t('cls.active', lang) : t('cls.inactive', lang)}
                    </Badge>
                  )},
                ],
                handleUnitEdit,
                handleUnitDelete,
                'cls.no_items',
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}