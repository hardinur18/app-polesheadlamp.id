import React from 'react';
import { Order, WATemplate } from '../master-data/data';
import { useMasterData } from '../master-data/context';
import { User, Calendar, MapPin, Wrench, Wallet, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';
import { getReasonSectionLabel, isReasonRequiredStatus } from './cancelReasonOptions';
import { getStatusBadgeVariant, getStatusLabel, getStatusReasonSummary } from './orderHelpers';
import { OrderInvoicePreviewDialog } from './OrderInvoicePreviewDialog';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isTechnicianRole } from '@/app/data/roleHelpers';
import {
  FoundationDetailField,
  FoundationDetailFieldGrid,
  FoundationDetailHero,
  FoundationDetailMetric,
  FoundationDetailMetricGrid,
  FoundationDetailSection,
  FoundationDetailShell,
} from '@/app/components/ui/detail-view';
import { Dialog, DialogFooter } from '../../components/ui/dialog';
import {
  MasterDataDialogBody,
  MasterDataFormDialogContent,
  MasterDataFormHeader,
} from '../../components/ui/master-data-ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

interface OrderDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export function OrderDetailDialog({ isOpen, onClose, order }: OrderDetailDialogProps) {
  const { users, services, vehicles, branches, areas, payments, platforms, subChannels, waTemplates, currentRole } = useMasterData();
  const { hasPermission } = usePermissions();
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = React.useState(false);
  const canViewCustomerContact = hasPermission('customer.contact.view');
  const canViewStaffContact = hasPermission('staff.contact.view');
  const canViewRoute = hasPermission('map.view_route');
  const canCopyOrderSummary = canViewCustomerContact || canViewStaffContact || canViewRoute;

  if (!order) return null;

  const technician = users.find(u => u.id === order.technicianId);
  const cs = users.find(u => u.id === order.csId);
  const service = services.find(s => s.id === order.serviceId);
  const vehicle = vehicles.find(v => v.id === order.vehicleId);
  const branch = branches.find(b => b.id === order.branchId);
  const area = areas.find(a => a.id === order.areaId);
  const advertiser = users.find(u => u.id === order.advertiserId);
  const paymentMethod = payments.find(p => p.id === order.paymentMethodId);
  const platform = platforms.find(p => p.id === order.platformId);
  const subChannel = subChannels.find(s => s.id === order.subChannelId);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatShortDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (value?: number | null) => `Rp ${(value || 0).toLocaleString('id-ID')}`;
  const effectiveStatus = ((order.photos as any)?._status && ['processing', 'pending'].includes(order.status))
    ? (order.photos as any)._status
    : order.status;
  const reasonSummary = getStatusReasonSummary(order, effectiveStatus);

  const handleCopyToWhatsApp = async () => {
    const formattedDate = formatDate(order.serviceDate);
    const vehicleName = vehicle ? `${vehicle.name} (${vehicle.category})` : '-';
    const paymentStatusText = order.paymentStatus === 'Unpaid' ? 'Belum Bayar' : order.paymentStatus === 'Paid' ? 'Lunas' : order.paymentStatus;

    const parts = [
      order.id,
      '',
      order.customerName,
    ];

    if (canViewCustomerContact) {
      parts.push(order.customerPhone);
    }

    if (canViewCustomerContact || canViewRoute) {
      parts.push(order.address);
    }

    if (canViewRoute && order.mapsUrl) {
      parts.push(order.mapsUrl);
    }

    parts.push('');
    parts.push(vehicleName);
    parts.push(`Rp ${order.price.toLocaleString('id-ID')}`);
    parts.push(platform?.name || '-');
    parts.push(subChannel?.name || '-');
    parts.push(order.serviceCategory || '-');

    parts.push('');
    parts.push(formattedDate);
    parts.push(order.serviceTime);

    if (canViewStaffContact) {
      parts.push(`Teknisi: ${technician?.name || '-'}`);
      parts.push(`CS: ${cs?.name || '-'}`);
    }

    parts.push('');
    parts.push(`Status: ${paymentStatusText}`);
    parts.push(`Metode: ${order.paymentType || '-'}`);

    if (order.notes) {
      parts.push('');
      parts.push(`Catatan: ${order.notes}`);
    }

    const text = parts.join('\n').trim();

    copyToClipboard(text, {
      successMessage: 'Detail pesanan berhasil disalin!',
      description: 'Siap ditempel ke WhatsApp'
    });
  };

  const handleWhatsappTemplate = (template?: WATemplate) => {
    const phone = order.customerPhone.replace(/^0/, '62').replace(/\D/g, '');
    let message = "";

    if (template) {
        message = template.message;
        message = message.replace(/\[Nama\]/g, order.customerName);
        message = message.replace(/\[Mobil\]/g, vehicle?.name || 'mobil');
        message = message.replace(/\[Order ID\]/g, `\`\`\`${order.id}\`\`\``);
    }
    
    const url = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    window.open(url, '_blank');
  };

  const handleOpenMaps = () => {
    if (!order.mapsUrl) return;
    window.open(order.mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const invoiceContext = {
    order,
    service,
    vehicle,
    branch,
    area,
    cs,
    advertiser,
    technician,
    paymentMethod,
    platform,
    subChannel,
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <MasterDataFormDialogContent size="wide" className="orderDetailDialog">
        <MasterDataFormHeader
          icon={User}
          title={
            <span className="orderDetailTitle">
            <span>Detail Pesanan</span>
            <span
                onClick={() => {
                    copyToClipboard(order.id, {
                        successMessage: "ID Order disalin!",
                        description: "Siap ditempel ke WhatsApp"
                    });
                }}
                className="cursor-pointer rounded-md bg-blue-50 px-2 py-0.5 font-mono text-base text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                title="Klik untuk menyalin ID"
            >
                #{order.id}
            </span>
            </span>
          }
          description="Ringkasan data pesanan, pelanggan, jadwal, pembayaran, dan tim."
        />
        <MasterDataDialogBody compact className="orderDetailBody">
          <FoundationDetailShell className="orderDetailView">
        <FoundationDetailHero
          avatar={<User className="h-5 w-5" />}
          eyebrow="Pesanan service"
          title={order.customerName}
          subtitle={
            <span className="orderDetailSubtitle">
              <span>#{order.id}</span>
              <span>{canViewCustomerContact ? order.customerPhone : 'Akses kontak pelanggan dibatasi'}</span>
              <span>{formatShortDate(order.serviceDate)} {order.serviceTime || ''}</span>
            </span>
          }
          badges={
            <>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeVariant(effectiveStatus)}`}>
                {getStatusLabel(effectiveStatus)}
              </span>
              {platform?.name ? (
                <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                  {platform.name}{subChannel?.name ? ` / ${subChannel.name}` : ''}
                </span>
              ) : null}
            </>
          }
          actions={
            <div className="orderDetailHeroActions">
            {canViewCustomerContact ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="orderDetailTriggerButton" type="button">
                  <WhatsappIcon className="h-4 w-4" />
                  <span>Chat</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[280px]">
                  <DropdownMenuLabel>Pilih Template Pesan</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleWhatsappTemplate()}>
                    Chat Tanpa Template
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {waTemplates.filter(t => t.category === 'Orders' || t.category === 'General' || !t.category).map(t => (
                    <DropdownMenuItem key={t.id} onClick={() => handleWhatsappTemplate(t)}>
                      <span className="truncate">{t.title}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {canViewRoute && order.mapsUrl ? (
              <Button type="button" variant="outline" onClick={handleOpenMaps}>
                <MapPin className="h-4 w-4" />
                Maps
              </Button>
            ) : null}
            </div>
          }
        />

        <FoundationDetailMetricGrid className="orderDetailMetrics">
          <FoundationDetailMetric
            icon={CheckCircle2}
            label="Status"
            value={getStatusLabel(effectiveStatus)}
            description={reasonSummary || 'Status pengerjaan saat ini'}
          />
          <FoundationDetailMetric
            icon={Calendar}
            label="Tanggal Pengerjaan"
            value={formatShortDate(order.serviceDate)}
            description={order.serviceTime || '-'}
          />
          <FoundationDetailMetric
            icon={Wrench}
            label="Layanan"
            value={service?.name || '-'}
            description={vehicle ? `${vehicle.name}${vehicle.category ? ` (${vehicle.category})` : ''}` : '-'}
          />
          <FoundationDetailMetric
            icon={Wallet}
            label="Total Biaya"
            value={formatCurrency(order.price)}
            description={order.paymentStatus || 'Unpaid'}
          />
        </FoundationDetailMetricGrid>

        <FoundationDetailSection
          title="Informasi Pelanggan"
          description="Data kontak dan lokasi pengerjaan."
          actions={canViewRoute && order.mapsUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={handleOpenMaps}>
              <MapPin className="h-4 w-4" />
              Buka Maps
            </Button>
          ) : null}
        >
          <FoundationDetailFieldGrid>
            <FoundationDetailField label="Nama Lengkap">{order.customerName}</FoundationDetailField>
            <FoundationDetailField label="Nomor Telepon">
              {canViewCustomerContact ? order.customerPhone : 'Akses kontak dibatasi'}
            </FoundationDetailField>
            <FoundationDetailField label="Alamat" span="full">
              {canViewCustomerContact || canViewRoute ? order.address : 'Akses alamat dibatasi'}
            </FoundationDetailField>
          </FoundationDetailFieldGrid>
        </FoundationDetailSection>

        <div className="orderDetailSectionGrid">
          <FoundationDetailSection title="Jadwal & Tim" description="Status pengerjaan dan penugasan operasional.">
            <FoundationDetailFieldGrid>
              <FoundationDetailField label="Status Pengerjaan">
                <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeVariant(effectiveStatus)}`}>
                  {getStatusLabel(effectiveStatus)}
                </span>
              </FoundationDetailField>
              <FoundationDetailField label="Tanggal & Jam">
                {formatDate(order.serviceDate)} - {order.serviceTime || '-'}
              </FoundationDetailField>
              <FoundationDetailField label="Teknisi">{technician?.name || '-'}</FoundationDetailField>
              <FoundationDetailField label="CS">{cs?.name || '-'}</FoundationDetailField>
              <FoundationDetailField label="Advertiser">{advertiser?.name || '-'}</FoundationDetailField>
              <FoundationDetailField label="Cabang / Area">
                {branch?.name || '-'}{area?.name ? ` / ${area.name}` : ''}
              </FoundationDetailField>
              {reasonSummary ? (
                <FoundationDetailField label={getReasonSectionLabel(order.status)} span="full">
                  {reasonSummary}
                </FoundationDetailField>
              ) : null}
              {isReasonRequiredStatus(order.status) && order.cancelReason === 'Lainnya' && order.cancelReasonNote ? (
                <FoundationDetailField label="Catatan Alasan" span="full">
                  {order.cancelReasonNote}
                </FoundationDetailField>
              ) : null}
            </FoundationDetailFieldGrid>
          </FoundationDetailSection>

          <FoundationDetailSection title="Layanan & Sumber" description="Paket, kendaraan, dan asal order.">
            <FoundationDetailFieldGrid>
              <FoundationDetailField label="Layanan">{service?.name || '-'}</FoundationDetailField>
              <FoundationDetailField label="Kategori">{order.serviceCategory || '-'}</FoundationDetailField>
              <FoundationDetailField label="Kendaraan">
                {vehicle ? `${vehicle.name}${vehicle.category ? ` (${vehicle.category})` : ''}` : '-'}
              </FoundationDetailField>
              <FoundationDetailField label="Unit">{order.units || 1}</FoundationDetailField>
              <FoundationDetailField label="Platform">
                {platform?.name || '-'}{subChannel?.name ? ` / ${subChannel.name}` : ''}
              </FoundationDetailField>
              <FoundationDetailField label="Tanggal Leads">{formatShortDate(order.leadDate)}</FoundationDetailField>
            </FoundationDetailFieldGrid>
          </FoundationDetailSection>
        </div>

        <FoundationDetailSection title="Pembayaran" description="Status, metode, dan akun pembayaran.">
          <FoundationDetailFieldGrid>
            <FoundationDetailField label="Total Biaya">{formatCurrency(order.price)}</FoundationDetailField>
            <FoundationDetailField label="Status Pembayaran">{order.paymentStatus || 'Unpaid'}</FoundationDetailField>
            <FoundationDetailField label="Metode">{order.paymentType || '-'}</FoundationDetailField>
            <FoundationDetailField label="Detail Bank">
              {order.paymentType === 'Transfer' && paymentMethod
                ? `${paymentMethod.bankName} / ${paymentMethod.accountNumber}`
                : '-'}
            </FoundationDetailField>
          </FoundationDetailFieldGrid>
        </FoundationDetailSection>

        <FoundationDetailSection title="Catatan" description="Catatan internal yang tersimpan di pesanan.">
          <div className="foundationDetailTextBlock">
            {order.notes || 'Tidak ada catatan.'}
          </div>
        </FoundationDetailSection>
          </FoundationDetailShell>
        </MasterDataDialogBody>

        <DialogFooter className="masterDataFormActions orderDetailFooter">
          <div className={`orderDetailFooterInner ${canCopyOrderSummary ? 'hasCopyAction' : ''}`}>
             {canCopyOrderSummary && (
               <Button
                variant="outline"
                onClick={handleCopyToWhatsApp}
                className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
               >
                 <Copy className="h-4 w-4" />
                 Salin Info
               </Button>
             )}

            <div className="orderDetailFooterActions">
              <Button variant="outline" onClick={onClose} className="border-slate-200 dark:border-slate-700">
                Tutup
              </Button>
              {!isTechnicianRole(currentRole) && (
                <Button onClick={() => setIsInvoicePreviewOpen(true)} className="bg-blue-600 text-white hover:bg-blue-700">
                   Cetak Kwitansi
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>

      </MasterDataFormDialogContent>
    </Dialog>
    <OrderInvoicePreviewDialog
      isOpen={isInvoicePreviewOpen}
      onClose={() => setIsInvoicePreviewOpen(false)}
      context={invoiceContext}
    />
    </>
  );
}
