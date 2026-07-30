import { AlertTriangle, Loader2, RefreshCcw, Smartphone } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { WhatsAppModuleFrame } from './components/WhatsAppModuleFrame';
import {
  AccountStatusBadge,
  ProviderBadge,
  WhatsAppStateCard,
  formatDateTime,
  formatNumber,
  formatPhoneNumber,
} from './components/whatsappModuleShared';
import { useWhatsAppOverview } from './useWhatsAppOverview';

export function WhatsAppAccountsPage() {
  const { data, loading, refreshing, error, reload } = useWhatsAppOverview();
  const accounts = data?.accounts || [];

  const connectedCount = accounts.filter((account) => account.status === 'connected').length;

  return (
    <WhatsAppModuleFrame
      activeId="whatsapp-accounts"
      stats={[
        { label: 'Nomor Terdaftar', value: formatNumber(accounts.length) },
        { label: 'Terhubung', value: formatNumber(connectedCount) },
        {
          label: 'Via Kirimdev',
          value: formatNumber(accounts.filter((account) => account.provider === 'kirimdev').length),
        },
        {
          label: 'Meta langsung',
          value: formatNumber(accounts.filter((account) => account.provider === 'meta').length),
        },
      ]}
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
          title="Daftar nomor belum berhasil dimuat."
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Nomor WhatsApp Terhubung
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Setiap nomor dipetakan ke satu phone_number_id WhatsApp. Provider menunjukkan apakah
                data masuk lewat Kirimdev atau langsung dari Meta.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : accounts.length === 0 ? (
            <WhatsAppStateCard
              icon={<Smartphone className="h-5 w-5" />}
              title="Belum ada nomor WhatsApp yang dikenali."
              description="Set KIRIMDEV_PHONE_NUMBER_ID di server lalu subscribe webhook Kirimdev. Nomor akan muncul di sini setelah konfigurasi atau event pertama masuk."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {formatPhoneNumber(account.displayPhoneNumber || account.phoneNumberId)}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {account.label}
                      </div>
                    </div>
                    <AccountStatusBadge status={account.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ProviderBadge provider={account.provider} />
                    <Badge variant="outline">
                      {formatNumber(account.conversationCount)} percakapan
                    </Badge>
                    {account.subscribedFields.length > 0 ? (
                      <Badge variant="outline">{account.subscribedFields.length} field</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        phone_number_id
                      </div>
                      <div className="mt-1 truncate font-medium text-slate-900 dark:text-slate-100">
                        {account.phoneNumberId}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Event terakhir
                      </div>
                      <div className="mt-1 truncate font-medium text-slate-900 dark:text-slate-100">
                        {formatDateTime(account.lastEventAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Kredensial nomor (API key & webhook secret) dikelola sepenuhnya di server. Halaman ini
            hanya menampilkan identitas publik (phone_number_id) dan status koneksi — tidak ada
            secret yang ditampilkan di sini.
          </div>
        </div>
      </Card>
    </WhatsAppModuleFrame>
  );
}
