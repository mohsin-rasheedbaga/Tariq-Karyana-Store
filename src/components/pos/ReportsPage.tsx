'use client';

import { Receipt, ShoppingCart, Package, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReportsPage() {
  const reportCards = [
    { title: 'سیل ریپورٹ', titleUr: 'فروخت کی رپورٹس', icon: <ShoppingCart className="h-6 w-6" />, color: 'text-emerald-600 bg-emerald-50', desc: 'دن، ہفتہ، مہینہ وار فروخت' },
    { title: 'پچیس ریپورٹ', titleUr: 'خریداری کی رپورٹس', icon: <Receipt className="h-6 w-6" />, color: 'text-blue-600 bg-blue-50', desc: 'پارٹی وار، دن وار خریداری' },
    { title: 'اسٹاک ریپورٹ', titleUr: 'اسٹاک کی تفصیلات', icon: <Package className="h-6 w-6" />, color: 'text-purple-600 bg-purple-50', desc: 'گروپ وار، کمپنی وار اسٹاک' },
    { title: 'پروفٹ ریپورٹ', titleUr: 'منافع کی رپورٹس', icon: <TrendingUp className="h-6 w-6" />, color: 'text-amber-600 bg-amber-50', desc: 'دن وار، انوائس وار منافع' },
    { title: 'اخراجات ریپورٹ', titleUr: 'اخراجات کی رپورٹس', icon: <DollarSign className="h-6 w-6" />, color: 'text-red-600 bg-red-50', desc: 'ٹائپ وار، دن وار اخراجات' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ریپورٹس</h2>
      <p className="text-muted-foreground">ریپورٹس سیکشن جلد مکمل ہوگا۔ فی الحال ڈیش بورڈ پر بنیادی اعداد و شمار دستیاب ہیں۔</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map(r => (
          <Card key={r.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${r.color}`}>{r.icon}</div>
                <div>
                  <h3 className="font-bold text-lg">{r.titleUr}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}