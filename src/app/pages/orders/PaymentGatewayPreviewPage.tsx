import React from 'react';
import { ArrowLeft, CreditCard, RefreshCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { MasterDataProvider } from '../master-data/context';
import { PermissionsProvider } from '@/app/hooks/usePermissions';
import { OrderPaymentDialog } from './OrderPaymentDialog';
import { Order, PaymentMethod, PaymentTransaction } from '../master-data/data';

const previewPayments: PaymentMethod[] = [
  {
    id: 'pm-preview-bca',
    bankName: 'BCA',
    accountNumber: '8730123456',
    accountHolder: 'PT Restoration Headlamp',
    status: 'active',
  },
];

const previewOrder: Order = {
  id: 'ORD-PGW-001',
  leadDate: '2026-04-11',
  customerName: 'Raka Pratama',
  customerPhone: '081234567890',
  address: 'Jl. Boulevard Raya No. 8, Kelapa Gading, Jakarta Utara',
  serviceDate: '2026-04-12',
  serviceTime: '13:00',
  serviceId: 'svc-preview',
  serviceCategory: 'Restoration',
  vehicleId: 'veh-preview',
  units: 1,
  price: 650000,
  branchId: 'b3',
  areaId: '4',
  status: 'processing',
  paymentType: 'Transfer',
  paymentMethodId: 'pm-preview-bca',
  paymentStatus: 'Unpaid',
  paymentValidation: 'Pending',
  notes: 'Preview lokal untuk QRIS dinamis per order.',
};

const previewTransactions: PaymentTransaction[] = [
  {
    id: 'preview-active-001',
    orderId: previewOrder.id,
    amount: 650000,
    paymentMethod: 'qris',
    gatewayProvider: 'xendit',
    status: 'requires_action',
    providerStatus: 'REQUIRES_ACTION',
    channelCode: 'QRIS',
    referenceId: 'RHI-ORD-PGW-001-240411',
    paymentRequestId: 'payreq-preview-001',
    qrString: '00020101021226670016COM.NOBUBANK.WWW01189360050300000879140214RHIORDPGW0015204549953033605802ID5917RESTORATION RHI6007JAKARTA6105123456304ABCD',
    checkoutUrl: 'https://checkout.xendit.co/web/payreq-preview-001',
    expiresAt: '2026-04-13T20:00:00.000Z',
    description: 'QRIS aktif untuk preview order',
    metadata: { preview: true },
    createdAt: '2026-04-11T12:00:00.000Z',
    updatedAt: '2026-04-11T12:00:00.000Z',
  },
  {
    id: 'preview-expired-001',
    orderId: previewOrder.id,
    amount: 650000,
    paymentMethod: 'qris',
    gatewayProvider: 'mock',
    status: 'expired',
    providerStatus: 'EXPIRED',
    channelCode: 'QRIS',
    referenceId: 'RHI-ORD-PGW-001-240410',
    paymentRequestId: 'payreq-preview-000',
    qrString: '00020101021226670016COM.NOBUBANK.WWW01189360050300000879140214RHIORDPGW0005204549953033605802ID5917RESTORATION RHI6007JAKARTA6105123456304EFGH',
    expiresAt: '2026-04-10T18:00:00.000Z',
    description: 'QRIS preview sebelumnya yang sudah expired',
    metadata: { preview: true },
    createdAt: '2026-04-10T10:00:00.000Z',
    updatedAt: '2026-04-10T18:00:00.000Z',
  },
];

function PaymentGatewayPreviewContent() {
  const [isOpen, setIsOpen] = React.useState(true);

  React.useEffect(() => {
    document.title = 'Payment Gateway Preview - Restoration Headlamp Indonesia';
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-3xl border border-white/70 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-200/70 dark:shadow-slate-900/70 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                <CreditCard className="h-3.5 w-3.5" />
                Payment Gateway Preview
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Preview localhost untuk fitur QRIS dinamis per order</h1>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Halaman ini menampilkan UI payment gateway yang sudah kita siapkan. Tombol generate, refresh, dan cancel memakai simulasi lokal agar mudah dicek tanpa login dulu.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => (window.location.href = '/')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke App
              </Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setIsOpen(true)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Buka Modal Preview
              </Button>
            </div>
          </div>
        </div>
      </div>

      <OrderPaymentDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        order={previewOrder}
        previewMode
        previewPayments={previewPayments}
        previewTransactions={previewTransactions}
      />
    </div>
  );
}

export function PaymentGatewayPreviewPage() {
  return (
    <MasterDataProvider>
      <PermissionsProvider>
        <PaymentGatewayPreviewContent />
      </PermissionsProvider>
    </MasterDataProvider>
  );
}
