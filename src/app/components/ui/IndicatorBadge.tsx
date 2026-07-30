import React from 'react';

export type BadgeStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'done'
  | 'cancelled'
  | 'waiting'
  | 'reschedule'
  | 'on_the_way'
  | 'otw'
  | 'working'
  | 'qc'
  | 'teknisi_completed';

interface BadgeProps {
  status: BadgeStatus | string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400 dark:bg-slate-500',
    label: 'Terjadwal',
  },
  processing: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    label: 'Proses',
  },
  completed: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Selesai',
  },
  done: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Selesai',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'Batal',
  },
  waiting: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Menunggu',
  },
  reschedule: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
    label: 'Jadwal Ulang',
  },
  on_the_way: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    label: 'OTW',
  },
  otw: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    label: 'OTW',
  },
  working: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    label: 'Dikerjakan',
  },
  qc: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    label: 'QC',
  },
  teknisi_completed: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    label: 'Menunggu QC',
  }
};

export function IndicatorBadge({ status, label, size = 'md', className }: BadgeProps) {
  // Use lowercase for case-insensitive matching if needed, though usually statuses are lowercase
  const normalizedStatus = status?.toLowerCase() || 'pending';
  const config = statusConfig[normalizedStatus] || statusConfig.pending;
  
  const displayLabel = label || config.label;
  
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full
        ${config.bg} ${config.text}
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
        font-medium
        ${className || ''}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {displayLabel}
    </span>
  );
}
