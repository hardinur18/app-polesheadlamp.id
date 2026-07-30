import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';
import { CancelReason } from '../master-data/data';
import { getCancelReasonOptions, getReasonSectionLabel, isReasonRequiredStatus } from './cancelReasonOptions';

interface OrderStatusReasonFieldsProps {
  status?: string | null;
  cancelReasons: CancelReason[];
  value?: string | null;
  note?: string | null;
  onReasonChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  className?: string;
}

export function OrderStatusReasonFields({
  status,
  cancelReasons,
  value,
  note,
  onReasonChange,
  onNoteChange,
  className,
}: OrderStatusReasonFieldsProps) {
  const options = useMemo(() => {
    if (!isReasonRequiredStatus(status)) return [];
    return getCancelReasonOptions(status, cancelReasons, value);
  }, [cancelReasons, status, value]);

  if (!isReasonRequiredStatus(status)) return null;

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-900/10',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <Label className="text-sm font-bold text-amber-800 dark:text-amber-300">
          {getReasonSectionLabel(status)}
          <span className="ml-1 text-red-500">*</span>
        </Label>
      </div>

      <Select value={value || ''} onValueChange={onReasonChange}>
        <SelectTrigger className="border-amber-200 bg-white dark:border-amber-700 dark:bg-slate-800">
          <SelectValue placeholder="Pilih alasan..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((reason) => (
            <SelectItem key={reason.id} value={reason.label}>
              {reason.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === 'Lainnya' && (
        <Textarea
          value={note || ''}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Jelaskan alasan lainnya..."
          className="min-h-[60px] border-amber-200 bg-white dark:border-amber-700 dark:bg-slate-800"
        />
      )}
    </div>
  );
}
