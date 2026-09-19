import React from 'react';
import { CreditCard, Landmark, QrCode, ReceiptText } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/badge';
import { Order, PaymentMethod } from '../master-data/data';
import { useMasterData } from '../master-data/context';
import { Button } from '../../components/ui/button';
import { getBankLogoPublicUrl } from '@/app/services/bankLogoService';

interface OrderPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  previewMode?: boolean;
  previewPayments?: PaymentMethod[];
}

const statusClasses: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  Unpaid: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'Down Payment': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0);

export function OrderPaymentDialog({
  isOpen,
  onClose,
  order,
  previewMode = false,
  previewPayments,
}: OrderPaymentDialogProps) {
  const { orders, payments } = useMasterData();

  if (!order) return null;

  const activeOrder = previewMode ? order : orders.find((item) => item.id === order.id) || order;
  const paymentOptions = previewMode ? previewPayments || [] : payments;
  const paymentMethod = paymentOptions.find((item) => item.id === activeOrder.paymentMethodId);
  const isQrisPayment = paymentMethod?.accountType === 'qris';
  const qrisImageUrl = isQrisPayment ? getBankLogoPublicUrl(paymentMethod?.qrisImagePath) : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <span>Pembayaran Pesanan</span>
          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-base text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            #{activeOrder.id}
          </span>
        </div>
      }
      footer={
        <div className="flex w-full justify-end">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <ReceiptText className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Pelanggan</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeOrder.customerName}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{activeOrder.customerPhone || '-'}</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <CreditCard className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Total Tagihan</span>
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-300">{formatCurrency(activeOrder.price)}</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status Bayar</div>
            <Badge variant="outline" className={statusClasses[activeOrder.paymentStatus] || 'border-slate-200 text-slate-600'}>
              {activeOrder.paymentStatus}
            </Badge>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <Landmark className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Metode</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeOrder.paymentType || '-'}</div>
            {activeOrder.paymentType === 'Transfer' && paymentMethod && (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isQrisPayment ? `${paymentMethod.bankName} - ${paymentMethod.accountHolder || 'QRIS'}` : `${paymentMethod.bankName} - ${paymentMethod.accountNumber}`}
              </div>
            )}
          </div>
        </div>

        {isQrisPayment && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <div className="mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <QrCode className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">QRIS Pembayaran</span>
            </div>
            <div className="grid gap-4 md:grid-cols-[176px_minmax(0,1fr)] md:items-center">
              <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-emerald-200 bg-white p-2 dark:border-emerald-900 dark:bg-slate-950">
                {qrisImageUrl ? (
                  <img src={qrisImageUrl} alt={`QRIS ${paymentMethod.bankName}`} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-semibold text-slate-400">QRIS belum diupload</span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Merchant</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{paymentMethod.accountHolder || paymentMethod.bankName}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nominal</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-300">{formatCurrency(activeOrder.price)}</div>
                </div>
                {paymentMethod.notes ? (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{paymentMethod.notes}</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
