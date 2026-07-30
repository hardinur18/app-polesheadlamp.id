import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  RefreshCcw,
  Webhook,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabaseUrl } from '/utils/supabase/info';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { WhatsAppModuleFrame } from './components/WhatsAppModuleFrame';
import { WhatsAppStateCard, formatDateTime, formatNumber } from './components/whatsappModuleShared';
import { useWhatsAppOverview } from './useWhatsAppOverview';

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

export function WhatsAppInboxSettingsPage() {
  const { data, loading, refreshing, error, reload } = useWhatsAppOverview();
  const kirimdev = data?.kirimdev;

  const webhookUrl = React.useMemo(() => {
    if (!kirimdev?.webhookPath) return '';
    return `${supabaseUrl}${kirimdev.webhookPath}`;
  }, [kirimdev?.webhookPath]);

  const handleCopy = React.useCallback(async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Disalin ke clipboard.');
    } catch {
      toast.error('Gagal menyalin. Salin manual ya.');
    }
  }, []);

  const ready = Boolean(kirimdev?.configured && kirimdev?.webhookSecretConfigured);

  return (
    <WhatsAppModuleFrame
      activeId="whatsapp-inbox-settings"
      actions={
        <Button
          variant="outline"
          onClick={() => void reload({ silent: true })}
          disabled={loading || refreshing}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      }
    >
      {error ? (
        <WhatsAppStateCard
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Status koneksi belum berhasil dimuat."
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <Card
            className={`shadow-sm ${
              ready
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
            }`}
          >
            <div className="flex items-start gap-3 p-5">
              {ready ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
              )}
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {ready ? 'Kirimdev terkonfigurasi' : 'Kirimdev belum siap menerima webhook'}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {ready
                    ? 'Server siap memverifikasi dan menyimpan event WhatsApp dari Kirimdev. Pastikan webhook sudah disubscribe di dashboard/API Kirimdev ke endpoint di bawah.'
                    : 'Lengkapi kredensial Kirimdev di environment server (phone_number_id dan webhook secret), lalu subscribe webhook dari dashboard/API Kirimdev.'}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 p-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Webhook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Endpoint Webhook
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Daftarkan URL ini sebagai tujuan webhook di Kirimdev. Kirimdev memakai header{' '}
                      <span className="font-mono text-xs">X-Kirim-Signature</span> untuk verifikasi.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      URL Webhook (POST)
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void handleCopy(webhookUrl)}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Salin
                    </Button>
                  </div>
                  <div className="mt-2 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                    {webhookUrl || 'URL belum tersedia.'}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Event yang disarankan
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(kirimdev?.recommendedEvents || []).map((event) => (
                      <Badge key={event} variant="outline" className="font-mono text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Belum ada event masuk? Webhook perlu disubscribe lebih dulu dari dashboard atau API
                  Kirimdev ke URL di atas. Setelah event pertama diterima, percakapan akan muncul di
                  menu Chats dan kontak di menu Contacts.
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="p-5">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Status Konfigurasi
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ConfigRow
                      label="phone_number_id"
                      value={kirimdev?.phoneNumberId || 'belum diatur'}
                    />
                    <ConfigRow
                      label="Nomor tampilan"
                      value={kirimdev?.displayPhoneNumber || '-'}
                    />
                    <ConfigRow
                      label="API key"
                      value={
                        <Badge
                          variant="outline"
                          className={
                            kirimdev?.apiKeyConfigured
                              ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                              : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                          }
                        >
                          {kirimdev?.apiKeyConfigured ? 'aktif (server)' : 'belum diatur'}
                        </Badge>
                      }
                    />
                    <ConfigRow
                      label="Webhook secret"
                      value={
                        <Badge
                          variant="outline"
                          className={
                            kirimdev?.webhookSecretConfigured
                              ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                              : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                          }
                        >
                          {kirimdev?.webhookSecretConfigured ? 'aktif (server)' : 'belum diatur'}
                        </Badge>
                      }
                    />
                    <ConfigRow
                      label="Toleransi replay"
                      value={`${formatNumber(kirimdev?.toleranceSeconds || 0)} detik`}
                    />
                    <ConfigRow
                      label="Event terakhir"
                      value={formatDateTime(kirimdev?.latestEventAt || null)}
                    />
                  </div>
                </div>
              </Card>

              <Card className="border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex items-start gap-3 p-5">
                  <Lock className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
                  <div className="text-sm leading-6 text-amber-800 dark:text-amber-200">
                    <div className="font-semibold">Kredensial tidak boleh masuk frontend</div>
                    <p className="mt-1">
                      API key Kirimdev (<span className="font-mono text-xs">KIRIMDEV_API_KEY</span>)
                      dan webhook secret (
                      <span className="font-mono text-xs">KIRIMDEV_WEBHOOK_SECRET</span>) hanya
                      diset di environment server (Supabase Edge Function). Halaman ini hanya
                      menampilkan status aktif/belum, bukan nilainya. Webhook akan menolak event
                      (fail closed) bila secret belum diset.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </WhatsAppModuleFrame>
  );
}
