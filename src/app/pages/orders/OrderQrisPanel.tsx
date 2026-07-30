import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { AlertTriangle, Copy, CreditCard, History, Loader2, RefreshCcw, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Order, PaymentTransaction } from '../master-data/data';
import {
  getPaymentGatewayNotice,
  orderPaymentService,
  type PaymentGatewayNotice,
} from '@/app/services/orderPaymentService';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useMasterData } from '@/app/pages/master-data/context';
import { copyToClipboard } from '@/lib/clipboard';

interface OrderQrisPanelProps {
  order: Order;
  previewMode?: boolean;
  previewTransactions?: PaymentTransaction[];
}

const sortTransactionsDesc = (items: PaymentTransaction[]) =>
  [...items].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );

const buildPreviewQrisString = (order: Order, referenceId: string) =>
  `00020101021226670016COM.NOBUBANK.WWW01189360050300000879140214${referenceId}5204549953033605802ID5917RESTORATION RHI6007JAKARTA6105123456304${order.id.slice(-4).toUpperCase()}`;

const createPreviewTransaction = (order: Order): PaymentTransaction => {
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const suffix = now.getTime().toString().slice(-6);
  const referenceId = `RHI-${order.id}-${suffix}`;

  return {
    id: `preview-${suffix}`,
    orderId: order.id,
    amount: Number(order.price || 0),
    paymentMethod: 'qris',
    gatewayProvider: 'xendit',
    status: 'requires_action',
    providerStatus: 'REQUIRES_ACTION',
    channelCode: 'QRIS',
    referenceId,
    paymentRequestId: `payreq-${suffix}`,
    qrString: buildPreviewQrisString(order, referenceId),
    checkoutUrl: `https://checkout.xendit.co/web/${referenceId}`,
    expiresAt,
    description: `Preview QRIS untuk order ${order.id}`,
    metadata: {
      preview: true,
      orderId: order.id,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0);

const formatDateTime = (value?: string) => {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const statusStyles: Record<PaymentTransaction['status'], string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  requires_action: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  expired: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  failed: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

const statusLabels: Record<PaymentTransaction['status'], string> = {
  pending: 'Pending',
  requires_action: 'Menunggu Pembayaran',
  paid: 'Lunas',
  expired: 'Expired',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
};

const QRIS_NOTICE_TOAST_ID = 'order-qris-notice';

export function OrderQrisPanel({
  order,
  previewMode = false,
  previewTransactions = [],
}: OrderQrisPanelProps) {
  const { hasPermission } = usePermissions();
  const { currentRole } = useMasterData();
  const role = currentRole || 'Owner';
  const canViewQris = previewMode || hasPermission('order.payment.qris.view') || hasPermission('order.payment.view');
  const canGenerateQris = previewMode || hasPermission('order.payment.qris.generate');
  const canRefreshQris = previewMode || hasPermission('order.payment.qris.refresh');
  const canCancelQris = previewMode || hasPermission('order.payment.qris.cancel');

  const [transactions, setTransactions] = useState<PaymentTransaction[]>(previewTransactions);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [serviceNotice, setServiceNotice] = useState<PaymentGatewayNotice | null>(null);

  const showGatewayNotice = (
    error: unknown,
    fallbackTitle: string,
    fallbackDescription: string,
    options?: { showToast?: boolean; toastId?: string },
  ) => {
    const notice = getPaymentGatewayNotice(error, {
      title: fallbackTitle,
      description: fallbackDescription,
    });

    setServiceNotice(notice);
    if (options?.showToast !== false) {
      toast.error(notice.title, {
        id: options?.toastId || QRIS_NOTICE_TOAST_ID,
        description: notice.description,
      });
    }
  };

  const loadTransactions = React.useCallback(async () => {
    if (previewMode) {
      setTransactions(sortTransactionsDesc(previewTransactions || []));
      return;
    }

    if (!canViewQris || !order?.id) return;

    setLoading(true);
    try {
      const nextTransactions = await orderPaymentService.listOrderTransactions(order.id, role);
      setTransactions(nextTransactions);
      setServiceNotice(null);
      toast.dismiss(QRIS_NOTICE_TOAST_ID);
    } catch (error) {
      showGatewayNotice(
        error,
        'Riwayat QRIS belum dapat dimuat',
        'Layanan QRIS sedang tidak tersedia untuk pesanan ini.',
        { showToast: false },
      );
    } finally {
      setLoading(false);
    }
  }, [canViewQris, order?.id, previewMode, previewTransactions]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const activeTransaction = useMemo(
    () => transactions.find((item) => ['pending', 'requires_action'].includes(item.status)),
    [transactions],
  );

  const latestTransaction = transactions[0];
  const qrisAmountMismatch = Boolean(
    activeTransaction && Number(activeTransaction.amount || 0) !== Number(order.price || 0),
  );
  const hasPaidTransaction = transactions.some((item) => item.status === 'paid');
  const serviceBlocked = !previewMode && Boolean(serviceNotice && serviceNotice.code !== 'validation_error');

  const mergeTransaction = (transaction: PaymentTransaction) => {
    setTransactions((prev) => {
      const next = [transaction, ...prev.filter((item) => item.id !== transaction.id)];
      return sortTransactionsDesc(next);
    });
  };

  const handleGenerate = async (force = false) => {
    if (!order?.id) return;
    setGenerating(true);
    try {
      if (previewMode) {
        const nowIso = new Date().toISOString();
        const transaction = createPreviewTransaction(order);
        setTransactions((prev) => {
          const next = prev.map((item) => {
            if (force && ['pending', 'requires_action'].includes(item.status)) {
              return {
                ...item,
                status: 'cancelled' as const,
                cancelledAt: nowIso,
                updatedAt: nowIso,
              };
            }

            return item;
          });

          return sortTransactionsDesc([transaction, ...next.filter((item) => item.id !== transaction.id)]);
        });
        toast.success(force ? 'Preview QRIS berhasil digenerate ulang' : 'Preview QRIS berhasil dibuat');
        return;
      }

      const result = await orderPaymentService.createQrisPayment(order.id, order, role, force);
      setServiceNotice(null);
      toast.dismiss(QRIS_NOTICE_TOAST_ID);
      mergeTransaction(result.data);
      await loadTransactions();
      toast.success(force ? 'Tagihan QRIS berhasil digenerate ulang' : 'Tagihan QRIS berhasil dibuat');
    } catch (error) {
      showGatewayNotice(
        error,
        'Tagihan QRIS belum berhasil dibuat',
        'Silakan cek kesiapan layanan pembayaran lalu coba lagi.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async (transactionId: string) => {
    setRefreshingId(transactionId);
    try {
      if (previewMode) {
        let nextStatusLabel = 'Status QRIS berhasil diperbarui';

        setTransactions((prev) =>
          sortTransactionsDesc(
            prev.map((item) => {
              if (item.id !== transactionId) return item;

              const nowIso = new Date().toISOString();
              if (item.status === 'pending') {
                nextStatusLabel = 'Preview QRIS berpindah ke menunggu pembayaran';
                return {
                  ...item,
                  status: 'requires_action',
                  providerStatus: 'REQUIRES_ACTION',
                  updatedAt: nowIso,
                };
              }

              if (item.status === 'requires_action') {
                nextStatusLabel = 'Preview QRIS ditandai lunas';
                return {
                  ...item,
                  status: 'paid',
                  providerStatus: 'SUCCEEDED',
                  paidAt: nowIso,
                  updatedAt: nowIso,
                };
              }

              return {
                ...item,
                updatedAt: nowIso,
              };
            }),
          ),
        );

        toast.success(nextStatusLabel);
        return;
      }

      const transaction = await orderPaymentService.refreshTransaction(transactionId, role);
      setServiceNotice(null);
      toast.dismiss(QRIS_NOTICE_TOAST_ID);
      mergeTransaction(transaction);
      await loadTransactions();
      toast.success('Status QRIS berhasil diperbarui');
    } catch (error) {
      showGatewayNotice(
        error,
        'Status QRIS belum berhasil diperbarui',
        'Layanan QRIS sedang belum bisa memeriksa status tagihan.',
      );
    } finally {
      setRefreshingId(null);
    }
  };

  const handleCancel = async (transactionId: string) => {
    setCancellingId(transactionId);
    try {
      if (previewMode) {
        const nowIso = new Date().toISOString();
        setTransactions((prev) =>
          sortTransactionsDesc(
            prev.map((item) =>
              item.id === transactionId
                ? {
                    ...item,
                    status: 'cancelled',
                    cancelledAt: nowIso,
                    updatedAt: nowIso,
                  }
                : item,
            ),
          ),
        );
        toast.success('Preview tagihan QRIS ditandai dibatalkan');
        return;
      }

      const transaction = await orderPaymentService.cancelTransaction(transactionId, role);
      setServiceNotice(null);
      toast.dismiss(QRIS_NOTICE_TOAST_ID);
      mergeTransaction(transaction);
      await loadTransactions();
      toast.success('Tagihan QRIS ditandai dibatalkan');
    } catch (error) {
      showGatewayNotice(
        error,
        'Tagihan QRIS belum berhasil dibatalkan',
        'Permintaan pembatalan belum bisa diproses saat ini.',
      );
    } finally {
      setCancellingId(null);
    }
  };

  if (!canViewQris) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tagihan QRIS</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate QRIS dinamis per pesanan langsung dari detail order.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canGenerateQris && !activeTransaction && (
            <Button
              size="sm"
              onClick={() => handleGenerate(false)}
              disabled={serviceBlocked || generating || (order.paymentStatus === 'Paid' && !qrisAmountMismatch)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Buat Tagihan QRIS
            </Button>
          )}

          {canGenerateQris && activeTransaction && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGenerate(true)}
              disabled={serviceBlocked || generating}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/20"
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Generate Ulang
            </Button>
          )}
        </div>
      </div>

      {serviceNotice && (
        <Alert
          className={
            serviceNotice.code === 'validation_error'
              ? 'mt-4 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
              : 'mt-4 border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
          }
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{serviceNotice.title}</AlertTitle>
          <AlertDescription>
            <p>{serviceNotice.description}</p>
            {serviceNotice.code !== 'validation_error' && (
              <p className="text-xs text-red-700/80 dark:text-red-200/80">
                Sementara itu, silakan gunakan metode pembayaran reguler atau hubungi admin untuk aktivasi layanan QRIS.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {qrisAmountMismatch && (
        <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <div className="ml-2 text-sm">
            Nominal QRIS aktif masih {formatCurrency(Number(activeTransaction?.amount || 0))}, sedangkan harga order sekarang {formatCurrency(Number(order.price || 0))}. Generate ulang supaya tagihan sinkron.
          </div>
        </Alert>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex h-[220px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : activeTransaction?.qrString ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-950/40">
                <QRCode
                  value={activeTransaction.qrString}
                  size={180}
                  className="h-auto w-full"
                  bgColor="transparent"
                  fgColor="currentColor"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    copyToClipboard(activeTransaction.qrString || '', {
                      successMessage: 'String QRIS berhasil disalin',
                      description: 'Siap dipakai untuk inspeksi atau support',
                    })
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Salin QR
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p>Belum ada QRIS aktif untuk pesanan ini.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Harga Order</div>
              <div className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">{formatCurrency(Number(order.price || 0))}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status Order</div>
              <div className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">{order.paymentStatus}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tagihan Aktif</div>
              <div className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                {activeTransaction ? formatCurrency(Number(activeTransaction.amount || 0)) : '-'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Gateway</div>
              <div className="mt-1 text-base font-bold capitalize text-slate-900 dark:text-slate-100">
                {activeTransaction?.gatewayProvider || latestTransaction?.gatewayProvider || '-'}
              </div>
            </div>
          </div>

          {activeTransaction && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusStyles[activeTransaction.status]}>
                      {statusLabels[activeTransaction.status]}
                    </Badge>
                    <span className="text-xs text-slate-500">Ref: {activeTransaction.referenceId || '-'}</span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Berlaku sampai <span className="font-semibold">{formatDateTime(activeTransaction.expiresAt)}</span>
                  </div>
                  {activeTransaction.gatewayProvider === 'mock' && (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      Mode simulasi masih aktif. Lengkapi konfigurasi Xendit di menu Payment Gateway agar tagihan masuk ke pembayaran nyata.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {canRefreshQris && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={serviceBlocked || refreshingId === activeTransaction.id}
                      onClick={() => handleRefresh(activeTransaction.id)}
                    >
                      {refreshingId === activeTransaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                      Refresh Status
                    </Button>
                  )}
                  {canCancelQris && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={serviceBlocked || cancellingId === activeTransaction.id}
                      className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                      onClick={() => handleCancel(activeTransaction.id)}
                    >
                      {cancellingId === activeTransaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                      Batalkan
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Riwayat Tagihan</h5>
            </div>

            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada riwayat tagihan QRIS untuk order ini.</p>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 5).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusStyles[transaction.status]}>
                          {statusLabels[transaction.status]}
                        </Badge>
                        <span className="text-xs text-slate-500">{formatDateTime(transaction.createdAt)}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(Number(transaction.amount || 0))}
                      </div>
                      <div className="text-xs text-slate-500">
                        {transaction.referenceId || transaction.paymentRequestId || transaction.id}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {transaction.qrString && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(transaction.qrString || '', {
                              successMessage: 'QR string berhasil disalin',
                            })
                          }
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Salin
                        </Button>
                      )}
                      {canRefreshQris && ['pending', 'requires_action'].includes(transaction.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={serviceBlocked || refreshingId === transaction.id}
                          onClick={() => handleRefresh(transaction.id)}
                        >
                          {refreshingId === transaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                          Refresh
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasPaidTransaction && (
              <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-300">
                Sistem akan menghitung payment QRIS yang sukses ke status order secara otomatis.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
