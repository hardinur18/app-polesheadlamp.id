import React, { useState } from 'react';
import {
  Building2, Users, Database, Wallet, Map, Activity, LayoutGrid, Monitor, Lock, Share2, Store, ReceiptText
} from 'lucide-react';
import { Tabs, TabsContent, TabsRail, TabsTrigger, TabsViewport } from '../../components/ui/tabs';
import { OperationalPageHeader, OperationalPageShell } from '../../components/ui/operational-page';
import { useMasterData } from '@/app/pages/master-data/context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { AdAccountTab } from './tabs/AdAccountTab';
import { AreasTab } from './tabs/AreasTab';
import { BranchesTab } from './tabs/BranchesTab';
import { ServicesTab } from './tabs/ServicesTab';
import { GenericMasterTab } from './tabs/GenericMasterTab';
import { OperationalExpenseCategoriesTab } from './tabs/OperationalExpenseCategoriesTab';
import { Role, VehicleType } from './data';
import { VehicleImportModal } from './modals/VehicleImportModal';
import { toast } from 'sonner';

interface MasterDataPageProps {
  currentRole: Role;
}

const MASTER_DATA_TAB_IDS = new Set([
  'branches',
  'areas',
  'services',
  'vendors',
  'cars',
  'platforms',
  'sub-channels',
  'ad-accounts',
  'payments',
  'operational-expense-categories',
  'roles',
]);

export const MasterDataPage: React.FC<MasterDataPageProps> = ({ currentRole }) => {
  const [activeTab, setActiveTab] = useState('branches');
  const { hasPermission } = usePermissions();

  if (!hasPermission('master_data.view')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50/50">
        <div className="text-center space-y-4 p-8 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-md">
           <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-red-500" />
           </div>
           <h2 className="text-xl font-bold text-slate-900">Akses Dibatasi</h2>
           <p className="text-slate-500 text-sm">
              Maaf, akun Anda dengan role <strong>{currentRole}</strong> tidak memiliki izin untuk mengakses halaman Master Data.
           </p>
        </div>
      </div>
    );
  }

  return (
    <MasterDataContent currentRole={currentRole} activeTab={activeTab} setActiveTab={setActiveTab} />
  );
};

const MasterDataContent: React.FC<{
  currentRole: Role; 
  activeTab: string; 
  setActiveTab: (val: string) => void;
}> = ({ currentRole, activeTab, setActiveTab }) => {
  const { 
    platforms, addPlatform, updatePlatform, deletePlatform,
    subChannels, addSubChannel, updateSubChannel, deleteSubChannel,
    vehicles, addVehicle, updateVehicle, deleteVehicle,
    payments, addPayment, updatePayment, deletePayment,
    roles, addRole, updateRole, deleteRole,
    vendors, addVendor, updateVendor, deleteVendor
  } = useMasterData();

  const [isImportVehicleOpen, setIsImportVehicleOpen] = useState(false);

  React.useEffect(() => {
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    if (queryTab && MASTER_DATA_TAB_IDS.has(queryTab) && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [activeTab, setActiveTab]);

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);

    const url = new URL(window.location.href);
    if (nextTab === 'branches') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', nextTab);
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const handleImportVehicle = async (importedVehicles: Partial<VehicleType>[]) => {
      let successCount = 0;
      let failCount = 0;
      let lastError = "";
      
      const toastId = toast.loading("Sedang menyimpan data...");

      for (const v of importedVehicles) {
          try {
              // @ts-ignore
              await addVehicle(v);
              successCount++;
          } catch (e: any) {
              console.error("Failed to add vehicle", v, e);
              failCount++;
              lastError = e.message || "Unknown error";
          }
      }
      
      toast.dismiss(toastId);

      if (successCount > 0) {
          toast.success(`${successCount} Tipe Mobil berhasil ditambahkan`);
      }
      
      if (failCount > 0) {
          toast.error(`Gagal menyimpan ${failCount} data. ${lastError ? `Error: ${lastError}` : ''}`);
      }
  };

  // Configuration for all tabs
  const tabs = [
    { id: 'branches', label: 'Cabang', icon: Building2 },
    { id: 'areas', label: 'Daerah', icon: Map },
    { id: 'services', label: 'Jenis Layanan', icon: Activity },
    { id: 'vendors', label: 'Vendor', icon: Store },
    { id: 'cars', label: 'Tipe Mobil', icon: Database },
    { id: 'platforms', label: 'Platform Iklan', icon: LayoutGrid },
    { id: 'sub-channels', label: 'Sub Channel', icon: Share2 },
    { id: 'ad-accounts', label: 'Akun Iklan', icon: Monitor },
    { id: 'payments', label: 'Akun Bank', icon: Wallet },
    { id: 'operational-expense-categories', label: 'Kategori Biaya', icon: ReceiptText },
    { id: 'roles', label: 'Role', icon: Users },
  ];

  return (
    <OperationalPageShell>
      <OperationalPageHeader
        title="Master Data"
        subtitle="Kelola data referensi operasional RHI untuk cabang, area, layanan, iklan, pembayaran, biaya, dan role."
        eyebrow="Data & Admin"
        icon={Database}
      />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="masterDataTabsShell">
          <TabsViewport>
            <TabsRail className="masterDataTabs min-w-max">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="masterDataTab">
                  {React.createElement(tab.icon, { className: 'h-4 w-4' })}
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsRail>
          </TabsViewport>

          {/* Custom Tabs */}
          <TabsContent value="branches" className="mt-0 focus-visible:ring-0">
            <BranchesTab currentRole={currentRole} />
          </TabsContent>

          <TabsContent value="areas" className="mt-0 focus-visible:ring-0">
            <AreasTab currentRole={currentRole} />
          </TabsContent>

          <TabsContent value="services" className="mt-0 focus-visible:ring-0">
            <ServicesTab currentRole={currentRole} />
          </TabsContent>

          <TabsContent value="vendors" className="mt-0 focus-visible:ring-0">
            <GenericMasterTab 
              currentRole={currentRole} 
              title="Vendor" 
              type="vendor"
              data={vendors}
              onAdd={addVendor}
              onUpdate={updateVendor}
              onDelete={deleteVendor}
              icon={Store}
              columns={[
                { header: 'Telepon', accessor: 'phone', width: 'w-1/4', render: (item) => item.phone || '-' },
                { header: 'Alamat', accessor: 'address', width: 'w-1/3', render: (item) => <span className="truncate max-w-[200px] block" title={item.address}>{item.address || '-'}</span> }
              ]}
            />
          </TabsContent>

          <TabsContent value="ad-accounts" className="mt-0 focus-visible:ring-0">
            <AdAccountTab currentRole={currentRole} />
          </TabsContent>

          {/* Generic Tabs */}
          <TabsContent value="cars" className="mt-0 focus-visible:ring-0">
            <GenericMasterTab 
              currentRole={currentRole} 
              title="Tipe Mobil" 
              type="vehicle"
              data={vehicles}
              onAdd={addVehicle}
              onUpdate={updateVehicle}
              onDelete={deleteVehicle}
              onImport={() => setIsImportVehicleOpen(true)}
              icon={Database}
              columns={[
                { header: 'Kategori', accessor: 'category', width: 'w-1/3', render: (item) => <span className="capitalize">{item.category}</span> }
              ]}
            />
          </TabsContent>

          <TabsContent value="platforms" className="mt-0 focus-visible:ring-0">
            <GenericMasterTab 
              currentRole={currentRole} 
              title="Platform Iklan" 
              type="simple"
              data={platforms}
              onAdd={addPlatform}
              onUpdate={updatePlatform}
              onDelete={deletePlatform}
              icon={LayoutGrid}
              hideDescription={true}
            />
          </TabsContent>

          <TabsContent value="sub-channels" className="mt-0 focus-visible:ring-0">
            <GenericMasterTab 
              currentRole={currentRole} 
              title="Sub Channel" 
              type="sub_channel"
              data={subChannels}
              onAdd={addSubChannel}
              onUpdate={updateSubChannel}
              onDelete={deleteSubChannel}
              icon={Share2}
              hideDescription={true}
              platforms={platforms}
              columns={[
                { 
                  header: 'Platform', 
                  accessor: 'platformId', 
                  width: 'w-1/3', 
                  render: (item) => {
                    const p = platforms.find(pl => pl.id === item.platformId);
                    return <span className="capitalize">{p?.name || '-'}</span>;
                  } 
                }
              ]}
            />
          </TabsContent>

          <TabsContent value="payments" className="mt-0 focus-visible:ring-0">
            <GenericMasterTab 
              currentRole={currentRole} 
              title="Akun Bank" 
              type="payment"
              data={payments}
              onAdd={addPayment}
              onUpdate={updatePayment}
              onDelete={deletePayment}
              icon={Wallet}
              columns={[
                { header: 'No. Rekening', accessor: 'accountNumber', width: 'w-1/4' },
                { header: 'Atas Nama', accessor: 'accountHolder', width: 'w-1/4' }
              ]}
            />
          </TabsContent>

          <TabsContent value="operational-expense-categories" className="mt-0 focus-visible:ring-0">
            <OperationalExpenseCategoriesTab />
          </TabsContent>

          <TabsContent value="roles" className="mt-0 focus-visible:ring-0">
            <GenericMasterTab 
              currentRole={currentRole} 
              title="Role" 
              type="simple"
              data={roles}
              onAdd={addRole}
              onUpdate={updateRole}
              onDelete={deleteRole}
              icon={Users}
              columns={[
                { header: 'Deskripsi', accessor: 'description', width: 'w-1/2', render: (item) => <span className="text-slate-500">{item.description || '-'}</span> }
              ]}
            />
          </TabsContent>

        </Tabs>

      <VehicleImportModal 
        isOpen={isImportVehicleOpen}
        onClose={() => setIsImportVehicleOpen(false)}
        onConfirm={handleImportVehicle}
      />
    </OperationalPageShell>
  );
};
