import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';

interface MasterDataDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  title: string;
  type?: 'simple' | 'vehicle' | 'payment' | 'sub_channel' | 'vendor';
  columns?: {
      header: string;
      accessor: string;
      render?: (item: any) => React.ReactNode;
  }[];
}

export const MasterDataDetailDialog: React.FC<MasterDataDetailDialogProps> = ({
  open,
  onOpenChange,
  item,
  title,
  type,
  columns
}) => {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-800">
        <DialogHeader>
          <DialogTitle>Detail {title}</DialogTitle>
          <DialogDescription>Informasi lengkap mengenai data {title.toLowerCase()}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2">
            {/* Common Fields */}
            <DetailRow label={`Nama ${title}`} value={item.name || item.bankName} />
            <DetailRow label="ID" value={item.id} />
            
            <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-700 items-center">
                <span className="text-slate-500 text-sm">Status</span>
                <Badge variant={item.status === 'active' ? 'default' : 'secondary'} 
                    className={item.status === 'active' 
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" 
                    : "bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200"}
                >
                    {item.status === 'active' ? 'AKTIF' : 'NON AKTIF'}
                </Badge>
            </div>

            {/* Specific Fields */}
            {type === 'vehicle' && (
                <DetailRow label="Kategori" value={item.category} capitalize />
            )}
            
            {type === 'payment' && (
                <>
                    <DetailRow label="Nomor Rekening" value={item.accountNumber} />
                    <DetailRow label="Atas Nama" value={item.accountHolder} />
                </>
            )}

            {/* Description if available */}
             {item.description && (
                <div className="py-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500 text-sm block mb-1">Deskripsi</span>
                    <p className="text-slate-900 dark:text-slate-200 text-sm leading-relaxed">{item.description}</p>
                </div>
            )}

             {/* Dynamic Columns from Props (if any extra) */}
             {columns?.map((col, idx) => {
                 if (['name', 'status', 'description', 'category', 'accountNumber', 'accountHolder'].includes(col.accessor)) return null;
                 return (
                     <div key={idx} className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-700 items-center">
                         <span className="text-slate-500 text-sm">{col.header}</span>
                         <div className="text-slate-900 dark:text-slate-200 text-sm font-medium text-right">
                             {col.render ? col.render(item) : item[col.accessor]}
                         </div>
                     </div>
                 )
             })}
        </div>
        
        <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DetailRow = ({ label, value, capitalize = false }: { label: string, value: React.ReactNode, capitalize?: boolean }) => (
    <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-700 items-center">
        <span className="text-slate-500 text-sm">{label}</span>
        <span className={`text-slate-900 dark:text-slate-200 text-sm font-medium ${capitalize ? 'capitalize' : ''}`}>{value || '-'}</span>
    </div>
);
