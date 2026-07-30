import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Order, WATemplate } from '../master-data/data';
import { useMasterData } from '../master-data/context';
import { 
  User, Calendar, MapPin, FileText, 
  Wrench, Building2, Wallet, Copy
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';
import { getReasonSectionLabel, isReasonRequiredStatus } from './cancelReasonOptions';
import { OrderInvoicePreviewDialog } from './OrderInvoicePreviewDialog';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isTechnicianRole } from '@/app/data/roleHelpers';
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

const Section = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
      <div className="rounded-md bg-slate-50 p-1.5 text-blue-600 dark:bg-slate-800 dark:text-blue-400">
         <Icon className="w-4 h-4" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
    </div>
    <div className="space-y-3">
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value, children, isBold = false }: { label: string, value?: string | number, children?: React.ReactNode, isBold?: boolean }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
    <div className={`text-sm text-slate-900 dark:text-slate-200 ${isBold ? 'font-bold' : 'font-medium'}`}>
      {children || value || '-'}
    </div>
  </div>
);

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

  const statusMap: Record<string, string> = {
      'pending': 'Menunggu',
      'processing': 'Proses',
      'waiting': 'Terjadwal',
      'done': 'Selesai',
      'cancelled': 'Batal',
      'reschedule': 'Jadwal Ulang'
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'pending': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
          case 'processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
          case 'waiting': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
          case 'done': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
          case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
          case 'reschedule': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
          default: return 'bg-slate-100 text-slate-700';
      }
  };

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
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
        </div>
      }
      size="lg"
      footer={
        <div className={`flex flex-col-reverse sm:flex-row w-full gap-3 sm:gap-0 ${canCopyOrderSummary ? 'sm:justify-between' : 'sm:justify-end'}`}>
           {canCopyOrderSummary && (
             <Button 
              variant="outline" 
              onClick={handleCopyToWhatsApp}
              className="w-full sm:w-auto border-green-200 hover:bg-green-50 text-green-700 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
             >
               <Copy className="w-4 h-4 mr-2" />
               Salin Info
             </Button>
           )}

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none border-slate-200 dark:border-slate-700">
              Tutup
            </Button>
            {!isTechnicianRole(currentRole) && (
              <Button onClick={() => setIsInvoicePreviewOpen(true)} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white">
                 Cetak Kwitansi
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
         <div className="space-y-4">
            <Section title="Informasi Pelanggan" icon={User}>
               <InfoRow label="Nama Lengkap" value={order.customerName} isBold />
               <InfoRow label="Nomor Telepon">
                  {canViewCustomerContact ? (
                  <div className="flex items-center gap-2">
                     <span>{order.customerPhone}</span>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-6 w-6 text-[#25D366] hover:text-[#128C7E] hover:bg-green-50 dark:hover:bg-green-900/20 p-0 rounded-full"
                             title="Chat WhatsApp"
                           >
                              <WhatsappIcon className="w-4 h-4" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[280px]">
                           <DropdownMenuLabel>Pilih Template Pesan</DropdownMenuLabel>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem onClick={() => handleWhatsappTemplate()}>
                              Chat Tanpa Template
                           </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           {waTemplates.filter(t => t.category === 'Leads' || t.category === 'General' || !t.category).map(t => (
                              <DropdownMenuItem key={t.id} onClick={() => handleWhatsappTemplate(t)}>
                                 <span className="truncate">{t.title}</span>
                              </DropdownMenuItem>
                           ))}
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
                  ) : (
                    <span className="text-slate-400">Akses kontak dibatasi</span>
                  )}
               </InfoRow>
               <InfoRow label="Alamat">
                  <span>{order.address}</span>
                  {canViewRoute && order.mapsUrl && (
                     <a href={order.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs mt-1.5 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
                        <MapPin className="w-3 h-3" /> Buka di Maps
                     </a>
                  )}
               </InfoRow>
            </Section>

            <Section title="Layanan & Kendaraan" icon={Wrench}>
               <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Layanan" value={service?.name} />
                  <InfoRow label="Kategori" value={order.serviceCategory} />
               </div>
               <InfoRow label="Kendaraan" value={`${vehicle?.name || '-'} ${vehicle?.category ? `(${vehicle.category})` : ''}`} />
               <InfoRow label="Total Biaya">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    Rp {order.price.toLocaleString('id-ID')}
                  </span>
               </InfoRow>
            </Section>
         </div>

         <div className="space-y-4">
             <Section title="Jadwal & Lokasi" icon={Calendar}>
                <div className="mb-3">
                   <InfoRow label="Status Pengerjaan">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase inline-block ${getStatusColor(order.status)}`}>
                         {statusMap[order.status] || order.status}
                      </span>
                   </InfoRow>
                </div>
                <InfoRow label="Tanggal Pengerjaan" value={formatDate(order.serviceDate)} isBold />
                <div className="grid grid-cols-2 gap-4">
                   <InfoRow label="Jam" value={order.serviceTime} />
                   <InfoRow label="Teknisi" value={technician?.name} />
                   <InfoRow label="CS" value={cs?.name} />
                   <InfoRow label="Advertiser" value={advertiser?.name} />
                </div>
                {isReasonRequiredStatus(order.status) && order.cancelReason && (
                   <div className="grid grid-cols-1 gap-3">
                      <InfoRow label={getReasonSectionLabel(order.status)} value={order.cancelReason} />
                      {order.cancelReason === 'Lainnya' && order.cancelReasonNote && (
                         <InfoRow label="Catatan Alasan" value={order.cancelReasonNote} />
                      )}
                   </div>
                )}
                <InfoRow label="Lokasi">
                   <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>{branch?.name} {area ? `- ${area.name}` : ''}</span>
                   </div>
                </InfoRow>
             </Section>

             <Section title="Pembayaran" icon={Wallet}>
                <div className="grid grid-cols-2 gap-4">
                   <InfoRow label="Status Pembayaran">
                      <span className={`
                        px-2 py-0.5 rounded text-xs font-bold uppercase
                        ${order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                        ${order.paymentStatus === 'Unpaid' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                        ${order.paymentStatus === 'Down Payment' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                      `}>
                        {order.paymentStatus}
                      </span>
                   </InfoRow>
                   <InfoRow label="Metode">
                      <span>{order.paymentType || '-'}</span>
                   </InfoRow>
                </div>
                {order.paymentType === 'Transfer' && (
                   <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <InfoRow label="Detail Bank">
                          {paymentMethod ? (
                            <div className="flex items-center gap-2">
                               <span className="font-bold">{paymentMethod.bankName}</span>
                               <span className="text-slate-400">|</span>
                               <span className="font-mono">{paymentMethod.accountNumber}</span>
                            </div>
                          ) : '-'}
                      </InfoRow>
                   </div>
                )}
             </Section>
             
             <Section title="Catatan" icon={FileText}>
                <p className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm italic text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  {order.notes ? `"${order.notes}"` : '-'}
                </p>
             </Section>
         </div>
      </div>

      <OrderInvoicePreviewDialog
        isOpen={isInvoicePreviewOpen}
        onClose={() => setIsInvoicePreviewOpen(false)}
        context={invoiceContext}
      />
    </Modal>
  );
}
