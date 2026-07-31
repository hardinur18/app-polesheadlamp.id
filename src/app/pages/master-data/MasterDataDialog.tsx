import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { MasterTabId, MasterDataItem } from './data';
import { BranchForm } from './forms/BranchForm';
import { AreaForm } from './forms/AreaForm';
import { ServiceTypeForm } from './forms/ServiceTypeForm';
import { GenericForm } from './forms/GenericForm';
import { AdAccountForm } from './forms/AdAccountForm';
import { AdSourceForm } from './forms/AdSourceForm';
import { TechnicianTeamForm } from './forms/TechnicianTeamForm';

interface MasterDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: MasterTabId;
  item?: MasterDataItem | null; // Null for Create, Object for Edit
  onSubmit: (data: any) => void;
  dependencies?: {
    branches?: any[];
    platforms?: any[];
    advertisers?: any[];
  }
}

export const MasterDataDialog: React.FC<MasterDataDialogProps> = ({ 
  open, 
  onOpenChange, 
  activeTab, 
  item, 
  onSubmit,
  dependencies = {}
}) => {
  
  const getTitle = () => {
    const action = item ? 'Edit' : 'Tambah';
    const labels: Record<string, string> = {
      branches: 'Cabang',
      areas: 'Daerah',
      services: 'Layanan',
      vehicles: 'Tipe Mobil',
      platforms: 'Platform Iklan',
      ad_accounts: 'Akun Iklan',
      sources: 'Sumber Iklan',
      payments: 'Metode Pembayaran',
      teams: 'Tim Teknisi',
      staff_status: 'Status Staff',
      employment: 'Tipe Kerja',
      banks: 'Bank'
    };
    return `${action} ${labels[activeTab] || 'Data'}`;
  };

  const handleFormSubmit = (data: any) => {
    onSubmit(data);
    onOpenChange(false);
  };

  const renderForm = () => {
    switch (activeTab) {
      case 'branches':
        return <BranchForm item={item as any} onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'areas':
        return <AreaForm item={item as any} branches={dependencies.branches || []} onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'services':
        return <ServiceTypeForm item={item as any} onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'ad_accounts':
        return (
          <AdAccountForm
            item={item as any}
            platforms={dependencies.platforms || []}
            advertisers={dependencies.advertisers || []}
            onSubmit={handleFormSubmit}
            onCancel={() => onOpenChange(false)}
          />
        );
      case 'sources':
        return <AdSourceForm item={item as any} onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'teams':
        return <TechnicianTeamForm item={item as any} onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'vehicles':
        return <GenericForm type="vehicle" item={item as any} label="Tipe Mobil" onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'payments':
        return <GenericForm type="payment" item={item as any} label="Metode Pembayaran" onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'platforms':
        return <GenericForm type="platform" item={item as any} label="Platform" onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'staff_status':
        return <GenericForm type="simple" item={item as any} label="Status Staff" onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'employment':
        return <GenericForm type="simple" item={item as any} label="Tipe Kerja" onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      case 'banks':
        return <GenericForm type="simple" item={item as any} label="Bank" onSubmit={handleFormSubmit} onCancel={() => onOpenChange(false)} />;
      default:
        return <div>Form belum tersedia</div>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px] ${activeTab === 'branches' ? 'sm:max-w-[650px]' : ''}`}>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {item ? 'Perbarui informasi data yang dipilih.' : 'Lengkapi formulir untuk menambahkan data baru.'}
          </DialogDescription>
        </DialogHeader>
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
};
