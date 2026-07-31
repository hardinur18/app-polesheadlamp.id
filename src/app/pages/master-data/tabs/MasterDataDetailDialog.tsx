import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { TableStatusIcon } from '../../../components/ui/data-table';
import { MasterDataDialogBody } from '../../../components/ui/master-data-ui';

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

        <MasterDataDialogBody compact>
          <div className="masterDataDetailRows">
            {/* Common Fields */}
            <DetailRow label={`Nama ${title}`} value={item.name || item.bankName} />
            <DetailRow label="ID" value={item.id} />
            
            <div className="masterDataDetailRow">
                <span className="masterDataDetailLabel">Status</span>
                <span className="masterDataDetailValue">
                <TableStatusIcon
                    label={item.status === 'active' || !item.status ? 'Aktif' : 'Non aktif'}
                    tone={item.status === 'active' || !item.status ? 'active' : 'inactive'}
                />
                </span>
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
                <div className="masterDataDetailDescription">
                    <span className="masterDataDetailLabel">Deskripsi</span>
                    <p>{item.description}</p>
                </div>
            )}

             {/* Dynamic Columns from Props (if any extra) */}
             {columns?.map((col, idx) => {
                 if (['name', 'status', 'description', 'category', 'accountNumber', 'accountHolder'].includes(col.accessor)) return null;
                 return (
                     <div key={idx} className="masterDataDetailRow">
                         <span className="masterDataDetailLabel">{col.header}</span>
                         <div className="masterDataDetailValue">
                             {col.render ? col.render(item) : item[col.accessor]}
                         </div>
                     </div>
                 )
             })}
          </div>
        
        <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </div>
        </MasterDataDialogBody>
      </DialogContent>
    </Dialog>
  );
};

const DetailRow = ({ label, value, capitalize = false }: { label: string, value: React.ReactNode, capitalize?: boolean }) => (
    <div className="masterDataDetailRow">
        <span className="masterDataDetailLabel">{label}</span>
        <span className={`masterDataDetailValue ${capitalize ? 'capitalize' : ''}`}>{value || '-'}</span>
    </div>
);
