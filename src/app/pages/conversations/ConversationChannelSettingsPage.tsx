import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Settings2,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import {
  fetchConversationInboxOverview,
  fetchConversationReadiness,
  syncConversationChannels,
} from '@/app/services/conversationCenterService';
import { ConversationWorkspaceFrame } from './components/ConversationWorkspaceFrame';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);

export function ConversationChannelSettingsPage() {
  const [readiness, setReadiness] = React.useState<Awaited<
    ReturnType<typeof fetchConversationReadiness>
  > | null>(null);
  const [overview, setOverview] = React.useState<Awaited<
    ReturnType<typeof fetchConversationInboxOverview>
  > | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [readinessPayload, overviewPayload] = await Promise.all([
        fetchConversationReadiness(),
        fetchConversationInboxOverview(),
      ]);
      setReadiness(readinessPayload);
      setOverview(overviewPayload);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat pengaturan channel.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSync = React.useCallback(async () => {
    setSyncing(true);
    try {
      await syncConversationChannels();
      toast.success('Channel berhasil disinkronkan.');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Sinkron channel gagal.');
    } finally {
      setSyncing(false);
    }
  }, [loadData]);

  return (
    <ConversationWorkspaceFrame
      title="Pusat Percakapan • Pengaturan Channel"
      description="Pantau kesehatan token Meta, status webhook, daftar channel yang aktif, dan kesiapan channel inbox live. TikTok DM tetap ditampilkan jujur sebagai lane yang belum punya adapter inbox server."
      badges={['Pusat Percakapan', 'Konektivitas Channel', 'Baca Saja']}
      stats={[
        {
          label: 'Channel Tersimpan',
          value: formatNumber(overview?.channels.length || 0),
        },
        {
          label: 'Messenger',
          value: formatNumber(readiness?.pageChannelCount || 0),
        },
        {
          label: 'Instagram',
          value: formatNumber(readiness?.instagramChannelCount || 0),
        },
        {
          label: 'Missing Scope',
          value: formatNumber(readiness?.missingScopes.length || 0),
        },
      ]}
      actions={
        <>
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={() => void handleSync()} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
            Sinkron Channel
          </Button>
        </>
      }
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="flex items-start gap-3 p-5 text-sm text-rose-700 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Pengaturan channel belum berhasil dimuat.</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <Settings2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Kesehatan Meta Messaging
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Status token, scope, dan konfigurasi webhook untuk Messenger, Instagram, dan WhatsApp.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="mt-4 space-y-3">
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : readiness ? (
              <div className="mt-4 space-y-4">
                <div
                  className={`rounded-2xl border p-4 ${
                    readiness.ok
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                      : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {readiness.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    )}
                    {readiness.ok ? 'Meta Messaging siap dipakai' : 'Masih ada catatan konfigurasi'}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Token type: {readiness.tokenType || '-'} • App Secret:{' '}
                    {readiness.appSecretConfigured ? 'aktif' : 'belum'} • Verify token:{' '}
                    {readiness.webhookVerifyTokenConfigured ? 'aktif' : 'belum'}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Scope Wajib
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {readiness.requiredScopes.map((scope) => {
                        const active = readiness.scopes.includes(scope);
                        return (
                          <Badge key={scope} variant="outline" className={active ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300' : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'}>
                            {scope}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Missing Scope
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {readiness.missingScopes.length > 0 ? (
                        readiness.missingScopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300">
                            {scope}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
                          Semua scope wajib aktif
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Daftar Channel Tersedia
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Channel yang bisa dibaca oleh inbox live saat ini.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <>
                  <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                </>
              ) : (
                <>
                  {(overview?.channels || []).map((channel) => (
                    <div
                      key={channel.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {channel.platform === 'instagram'
                              ? channel.instagramUsername || channel.instagramName || channel.pageName
                              : channel.whatsappDisplayPhoneNumber || channel.pageName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {channel.id}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {channel.platform === 'whatsapp' || channel.supportsMessaging ? 'Aktif' : 'Cek task'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{channel.platform}</Badge>
                        <Badge variant="outline">{channel.subscribedFields.length} field</Badge>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">TikTok DM</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Channel TikTok belum punya adapter inbox live server di repo ini. Jadi statusnya belum ikut ke daftar channel aktif, walau kredensial TikTok sudah tersedia untuk lane ads.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </ConversationWorkspaceFrame>
  );
}
