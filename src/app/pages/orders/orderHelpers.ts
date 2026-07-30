import { Order } from '../master-data/data';
import { isReasonRequiredStatus } from './cancelReasonOptions';

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return 'Terjadwal';
    case 'done': return 'Selesai';
    case 'reschedule': return 'Jadwal Ulang';
    case 'cancelled': return 'Cancel';
    case 'processing': return 'Proses';
    case 'otw': return 'OTW Jalan';
    case 'working': return 'Pengerjaan';
    case 'qc': return 'Menunggu QC';
    case 'teknisi_completed': return 'Menunggu QC';
    default: return status;
  }
};

export const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/50';
    case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50';
    case 'done': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50';
    case 'cancelled': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50';
    case 'reschedule': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50';
    case 'otw': return 'bg-sky-100 text-sky-700 border-sky-200 animate-pulse dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-900/50';
    case 'working': return 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case 'qc': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/50';
    case 'teknisi_completed': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/50';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export const getStatusReasonSummary = (order: Order, status?: string) => {
  const targetStatus = status || order.status;
  if (!isReasonRequiredStatus(targetStatus) || !order.cancelReason) return '';
  if (order.cancelReason === 'Lainnya') {
    return order.cancelReasonNote ? `Lainnya: ${order.cancelReasonNote}` : 'Lainnya';
  }
  return order.cancelReason;
};

export const normalizeReasonFilterValue = (value?: string | null) => (value || '').trim().toLowerCase();
