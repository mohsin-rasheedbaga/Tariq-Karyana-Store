'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Monitor, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/app-store';
import { t } from '@/lib/i18n';

export function NetworkPage() {
  const { lang } = useAppStore();
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [terminals, setTerminals] = useState<{ id: string; name: string; lastSeen: string }[]>([]);

  // Generate a random room code for this store
  useEffect(() => {
    const saved = localStorage.getItem('pos-room-code');
    if (saved) {
      setRoomCode(saved);
    } else {
      const code = 'TS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(code);
      localStorage.setItem('pos-room-code', code);
    }
  }, []);

  const handleConnect = () => {
    // WebSocket sync service connection placeholder
    // In production, this connects to the sync mini-service
    setConnected(true);
    setTerminals([
      { id: '1', name: 'Main Counter', lastSeen: new Date().toLocaleTimeString() },
    ]);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setTerminals([]);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">{t('net.title', lang)}</h2>

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {connected ? <Wifi className="h-5 w-5 text-emerald-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
            {t('net.status', lang)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={connected ? 'default' : 'secondary'} className={connected ? 'bg-emerald-100 text-emerald-700' : ''}>
              {connected ? t('net.connected', lang) : t('net.disconnected', lang)}
            </Badge>
            {connected && (
              <Badge className="bg-blue-100 text-blue-700">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> {t('net.sync_active', lang)}
              </Badge>
            )}
          </div>

          <div>
            <Label>{t('net.room_code', lang)}</Label>
            <div className="flex gap-2 mt-1">
              <Input value={roomCode} onChange={e => { setRoomCode(e.target.value); localStorage.setItem('pos-room-code', e.target.value); }} className="font-mono text-lg h-11" />
              <Button variant="outline" onClick={() => setRoomCode('TS-' + Math.random().toString(36).substring(2, 8).toUpperCase())}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === 'ur'
                ? 'یہ کوڈ دوسرے کمپیوٹرز پر بھی استعمال کریں تاکہ وہ اس سسٹم سے کنیکٹ ہوں'
                : 'Use this code on other computers to connect to this system'}
            </p>
          </div>

          {!connected ? (
            <Button className="bg-emerald-600 hover:bg-emerald-700 w-full h-12 text-lg" onClick={handleConnect}>
              <Wifi className="h-5 w-5 mr-2" /> {lang === 'ur' ? 'شیئرنگ شروع کریں' : 'Start Sharing'}
            </Button>
          ) : (
            <Button variant="destructive" className="w-full" onClick={handleDisconnect}>
              <WifiOff className="h-4 w-4 mr-2" /> {lang === 'ur' ? 'ڈسکنیکٹ' : 'Disconnect'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Connected Terminals */}
      {connected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="h-5 w-5" />
              {t('net.terminals', lang)} ({terminals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {terminals.map(term => (
                <div key={term.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium">{term.name} {term.id === '1' && <span className="text-xs text-emerald-600">({t('net.this_device', lang)})</span>}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{term.lastSeen}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              {lang === 'ur'
                ? 'نوٹ: نیٹ ورک شیئرنگ کے لیے تمام کمپیوٹرز ایک ہی WiFi نیٹ ورک پر ہونے چاہیئں۔ WebSocket سے لائیو ڈیٹا سینک ہوگا۔'
                : 'Note: All computers must be on the same WiFi network. Live data sync via WebSocket.'}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}