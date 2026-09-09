import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  RefreshCcw,
  Smartphone,
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
    <div className="waSettingsConfigRow border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="text-[11px] font-semibold uppercase tracking-[0] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function WhatsAppSettingsSkeleton() {
  return (
    <div className="waSettingsPage">
      <Card className="waSettingsCard">
        <div className="waSettingsCardBody">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-56 max-w-full rounded-md" />
              <Skeleton className="h-3 w-full max-w-3xl rounded-md" />
              <Skeleton className="h-3 w-2/3 max-w-xl rounded-md" />
            </div>
          </div>
        </div>
      </Card>

      <div className="waSettingsGrid">
        <Card className="waSettingsCard">
          <div className="waSettingsCardHeader">
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="h-3 w-full max-w-lg rounded-md" />
            </div>
          </div>
          <div className="waSettingsCardBody space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </Card>

        <div className="waSettingsSideStack">
          <Card className="waSettingsCard">
            <div className="waSettingsCardBody space-y-4">
              <Skeleton className="h-4 w-40 rounded-md" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            </div>
          </Card>
          <Card className="waSettingsCard">
            <div className="waSettingsCardBody space-y-4">
              <Skeleton className="h-4 w-44 rounded-md" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppInboxSettingsPage() {
  const { data, loading, refreshing, error, reload } = useWhatsAppOverview();
  const kirimdev = data?.kirimdev;
  const accounts = data?.accounts || [];
  const connectedAccounts = accounts.filter((account) => account.status === 'connected').length;

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
      stats={
        loading
          ? []
          : [
              {
                label: 'Nomor WA',
                value: formatNumber(accounts.length),
                hint: `${formatNumber(connectedAccounts)} terhubung`,
              },
              {
                label: 'Webhook',
                value: ready ? 'Siap' : 'Belum siap',
                hint: kirimdev?.webhookSecretConfigured ? 'Secret aktif' : 'Secret belum diatur',
              },
              {
                label: 'API Key',
                value: kirimdev?.apiKeyConfigured ? 'Aktif' : 'Belum',
                hint: 'Disimpan di server',
              },
              {
                label: 'Event',
                value: kirimdev?.latestEventAt ? 'Ada' : 'Belum',
                hint: formatDateTime(kirimdev?.latestEventAt || null),
              },
            ]
      }
      actions={
        <Button
          variant="outline"
          className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
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
        <WhatsAppSettingsSkeleton />
      ) : (
        <div className="waSettingsPage">
          <Card
            className={`waSettingsStatusCard shadow-sm ${
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

          <div className="waSettingsGrid">
            <Card className="waSettingsCard border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="waSettingsCardHeader border-b border-slate-200 dark:border-slate-800">
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

              <div className="waSettingsCardBody space-y-4">
                <div className="waSettingsConfigRow border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0] text-slate-500 dark:text-slate-400">
                      URL Webhook (POST)
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => void handleCopy(webhookUrl)}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Salin
                    </Button>
                  </div>
                  <div className="mt-2 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                    {webhookUrl || 'URL belum tersedia.'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0] text-slate-500 dark:text-slate-400">
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

                <div className="waSettingsNote border border-dashed border-slate-300 p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Belum ada event masuk? Webhook perlu disubscribe lebih dulu dari dashboard atau API
                  Kirimdev ke URL di atas. Setelah event pertama diterima, percakapan akan muncul di
                  menu Chats dan kontak di menu Contacts.
                </div>
              </div>
            </Card>

            <div className="waSettingsSideStack">
              <Card className="waSettingsCard border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="waSettingsCardBody">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Nomor Terhubung
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Ringkasan nomor WA yang dikenali dari provider.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ConfigRow label="Total nomor" value={formatNumber(accounts.length)} />
                    <ConfigRow label="Terhubung" value={formatNumber(connectedAccounts)} />
                  </div>

                  {accounts.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {accounts.map((account) => (
                        <div
                          key={account.id}
                          className="waSettingsAccountRow flex items-center justify-between gap-3 border border-slate-200 p-4 dark:border-slate-800"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {account.displayPhoneNumber || account.phoneNumberId}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                              {account.label}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              account.status === 'connected'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                                : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                            }
                          >
                            {account.status === 'connected' ? 'Terhubung' : account.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="waSettingsNote mt-4 border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Belum ada nomor yang dikenali dari provider.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="waSettingsCard border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="waSettingsCardBody">
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

              <Card className="waSettingsSecretNote border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
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
        </div>
      )}
    </WhatsAppModuleFrame>
  );
}
