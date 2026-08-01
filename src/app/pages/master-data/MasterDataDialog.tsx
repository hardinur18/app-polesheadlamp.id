import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import {
  MasterDataFormDialogContent,
  MasterDataUnsavedChangesDialog,
  useMasterDataFormCloseGuard,
} from '../../components/ui/master-data-ui';
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
  const [isFormDirty, setIsFormDirty] = React.useState(false);

  const closeFormDialog = React.useCallback(() => {
    setIsFormDirty(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const formCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isFormDirty,
    onClose: closeFormDialog,
  });
  
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
        return <BranchForm item={item as any} onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'areas':
        return <AreaForm item={item as any} branches={dependencies.branches || []} onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'services':
        return <ServiceTypeForm item={item as any} onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'ad_accounts':
        return (
          <AdAccountForm
            item={item as any}
            platforms={dependencies.platforms || []}
            advertisers={dependencies.advertisers || []}
            onSubmit={handleFormSubmit}
            onDirtyChange={setIsFormDirty}
            onCancel={formCloseGuard.requestClose}
          />
        );
      case 'sources':
        return <AdSourceForm item={item as any} onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'teams':
        return <TechnicianTeamForm item={item as any} onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'vehicles':
        return <GenericForm type="vehicle" item={item as any} label="Tipe Mobil" onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'payments':
        return <GenericForm type="payment" item={item as any} label="Metode Pembayaran" onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'platforms':
        return <GenericForm type="platform" item={item as any} label="Platform" onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'staff_status':
        return <GenericForm type="simple" item={item as any} label="Status Staff" onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'employment':
        return <GenericForm type="simple" item={item as any} label="Tipe Kerja" onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      case 'banks':
        return <GenericForm type="simple" item={item as any} label="Bank" onDirtyChange={setIsFormDirty} onSubmit={handleFormSubmit} onCancel={formCloseGuard.requestClose} />;
      default:
        return <div>Form belum tersedia</div>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      formCloseGuard.requestClose();
    }}>
      <MasterDataFormDialogContent size={activeTab === 'branches' ? 'wide' : 'default'}>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {item ? 'Perbarui informasi data yang dipilih.' : 'Lengkapi formulir untuk menambahkan data baru.'}
          </DialogDescription>
        </DialogHeader>
        {renderForm()}
      </MasterDataFormDialogContent>
      <MasterDataUnsavedChangesDialog
        open={formCloseGuard.isConfirmOpen}
        onCancel={formCloseGuard.cancelClose}
        onConfirm={formCloseGuard.confirmClose}
      />
    </Dialog>
  );
};
