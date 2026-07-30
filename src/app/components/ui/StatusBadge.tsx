import React from 'react';
import { Badge } from './badge';

export type StatusType = 'baru' | 'dihubungi' | 'menunggu' | 'selesai' | 'batal' | 'lunas' | 'belumbayar' | 'proses' | 'assign';

interface StatusBadgeProps {
  status: string | StatusType;
  className?: string;
  size?: string;
}

export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, size }) => {
  const normalizedStatus = status.toLowerCase().replace(/\s/g, '') as StatusType;

  const getStyle = (s: string) => {
    switch (s) {
      // Hijau (Sukses/Selesai/Lunas)
      case 'selesai':
      case 'lunas':
      case 'active':
        return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40 dark:border-emerald-700/40';

      // Biru (Proses/Baru/Assign)
      case 'baru':
      case 'assign':
      case 'assigned':
      case 'technician':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:border-blue-700/40';

      // Kuning/Oranye (Menunggu/Dihubungi/Proses)
      case 'menunggu':
      case 'dihubungi':
      case 'proses':
      case 'admin_pic':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/40 dark:border-amber-700/40';

      // Merah (Batal/Belum Bayar)
      case 'batal':
      case 'belumbayar':
      case 'inactive':
      case 'super_admin': // Role high alert
        return 'bg-red-100 text-red-700 hover:bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40 dark:border-red-700/40';

      // Ungu (Khusus Owner/Finance)
      case 'owner':
      case 'finance':
        return 'bg-violet-100 text-violet-700 hover:bg-violet-100 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/40 dark:border-violet-700/40';

      default:
        return 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-600';
    }
  };

  const getLabel = (s: string) => {
    const labels: Record<string, string> = {
      baru: 'Baru',
      dihubungi: 'Dihubungi',
      menunggu: 'Menunggu',
      selesai: 'Selesai',
      batal: 'Batal',
      lunas: 'Lunas',
      belumbayar: 'Belum Bayar',
      proses: 'Dalam Proses',
      assign: 'Ditugaskan',
      active: 'Aktif',
      inactive: 'Non-Aktif'
    };
    return labels[normalizedStatus] || status;
  };

  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : undefined;

  return (
    <Badge variant="outline" className={cn("capitalize font-medium border shadow-sm", getStyle(normalizedStatus), sizeClass, className)}>
      {getLabel(normalizedStatus)}
    </Badge>
  );
};
