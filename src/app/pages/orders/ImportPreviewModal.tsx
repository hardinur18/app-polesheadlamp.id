import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import { Badge } from '../../components/ui/badge';
import { Order } from '../master-data/data';
import { useMasterData } from '../master-data/context';
import { CheckCircle2, Trash2, Edit2, AlertCircle, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { isAdvertiserRole, isCsRole, isTechnicianRole } from '@/app/data/roleHelpers';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orders: Order[]) => Promise<void>;
  initialData: Order[];
}

export function ImportPreviewModal({ isOpen, onClose, onConfirm, initialData }: ImportPreviewModalProps) {
  const { services, users, branches, areas, platforms, vehicles } = useMasterData();
  const [data, setData] = useState<Order[]>([]);
  const [bulkValues, setBulkValues] = useState<Partial<Order>>({});
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Derived lists
  const technicians = users.filter(u => isTechnicianRole(u.role));
  const csUsers = users.filter(u => isCsRole(u.role));
  const advertisers = users.filter(u => isAdvertiserRole(u.role));

  useEffect(() => {
    if (isOpen) {
      setData(initialData);
      setCurrentPage(1); // Reset to first page on open
      setBulkValues({});
    }
  }, [isOpen, initialData]);

  // Pagination Logic
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = data.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleUpdateRow = (relativeIndex: number, field: keyof Order, value: any) => {
    // Calculate absolute index based on current page
    const absoluteIndex = (currentPage - 1) * itemsPerPage + relativeIndex;
    const newData = [...data];
    if (newData[absoluteIndex]) {
        let updatedRow = { ...newData[absoluteIndex], [field]: value };
        
        // Auto-update price if service changes
        if (field === 'serviceId') {
            const service = services.find(s => s.id === value);
            if (service) {
                updatedRow.price = service.price;
            }
        }

        newData[absoluteIndex] = updatedRow;
        setData(newData);
    }
  };

  const handleRemoveRow = (relativeIndex: number) => {
    const absoluteIndex = (currentPage - 1) * itemsPerPage + relativeIndex;
    const newData = data.filter((_, i) => i !== absoluteIndex);
    setData(newData);
    // Adjust current page if last item on page is removed
    if (paginatedData.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
    }
  };

  const handleBulkApply = (field: keyof Order) => {
    const value = bulkValues[field];
    if (!value) return;

    setData(prev => prev.map(o => {
        const newOrder = { ...o, [field]: value };
        // Auto-update price for bulk service change
        if (field === 'serviceId') {
            const service = services.find(s => s.id === value);
            if (service) {
                newOrder.price = service.price;
            }
        }
        return newOrder;
    }));
    toast.success(`Data kolom ${field} berhasil diperbarui untuk semua baris`);
  };

  const calculateTotal = () => {
    return data.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  };

  const isValidPrice = (price: any) => {
    return !isNaN(Number(price)) && Number(price) >= 0;
  };

  const formatCurrencyInput = (value: string) => {
    // Remove non-digits
    const number = value.replace(/\D/g, '');
    return number;
  };

  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || id;

  const isValidOption = (list: any[], id: any) => {
      if (!id) return true; // Allow empty if optional? Or handle separately. Assuming required for critical fields.
      // If the ID matches one in the list, it's valid.
      // Also check if the 'id' is actually the name (fallback), which is definitely invalid (unless name == id, which is rare)
      return list.some(item => item.id === id);
  };

  const getInvalidCount = () => {
     let count = 0;
     data.forEach(order => {
         // Critical fields validation
         if (order.serviceId && !isValidOption(services, order.serviceId)) count++;
         if (order.technicianId && !isValidOption(technicians, order.technicianId)) count++;
         if (order.csId && !isValidOption(csUsers, order.csId)) count++;
         if (order.advertiserId && !isValidOption(advertisers, order.advertiserId)) count++;
         if (order.branchId && !isValidOption(branches, order.branchId)) count++;
         if (order.platformId && !isValidOption(platforms, order.platformId)) count++;
         if (order.areaId && !isValidOption(areas, order.areaId)) count++;
         if (order.vehicleId && !isValidOption(vehicles, order.vehicleId)) count++; // Added vehicle validation
         if (!isValidPrice(order.price)) count++;
     });
     return count;
  };

  const handleSubmit = async () => {
    // Validation
    const invalidCount = getInvalidCount();
    
    if (invalidCount > 0) {
      toast.error(`Terdapat ${invalidCount} data yang belum valid (ditandai merah). Harap perbaiki atau pilih dari dropdown sebelum menyimpan.`);
      return;
    }
    await onConfirm(data);
  };

  const renderSelect = (
      list: any[], 
      value: any, 
      field: keyof Order, 
      idx: number, 
      placeholder: string
  ) => {
      const isValid = isValidOption(list, value);
      
      return (
          <Select 
            value={isValid ? value : undefined} 
            onValueChange={(val) => handleUpdateRow(idx, field, val)}
          >
            <SelectTrigger className={`h-9 text-xs w-full bg-white ${!isValid && value ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
              <SelectValue placeholder={!isValid && value ? value : placeholder} />
            </SelectTrigger>
            <SelectContent>
              {list.map(item => (
                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
      );
  };

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
          case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'done': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'reschedule': return 'bg-orange-100 text-orange-700 border-orange-200';
          case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-slate-100 text-slate-700';
      }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Konfirmasi Import Data (${data.length} Pesanan)`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Bulk Actions Toolbar */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
           <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                 <Edit2 className="w-4 h-4 text-slate-500" />
                 <h3 className="text-sm font-semibold text-slate-700">Edit Massal</h3>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs text-emerald-700 font-medium">Total Income:</span>
                  <span className="text-sm font-mono font-bold text-emerald-700">Rp {calculateTotal().toLocaleString('id-ID')}</span>
              </div>
           </div>
           
           <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {/* Service */}
              <div className="min-w-[250px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Layanan Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.serviceId || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, serviceId: val}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih Layanan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('serviceId')} disabled={!bulkValues.serviceId}>
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* Status */}
              <div className="min-w-[200px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Status Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.status || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, status: val as Order['status']}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih Status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Terjadwal</SelectItem>
                      <SelectItem value="processing">Proses</SelectItem>
                      <SelectItem value="done">Selesai</SelectItem>
                      <SelectItem value="cancelled">Batal</SelectItem>
                      <SelectItem value="reschedule">Reschedule</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('status')} disabled={!bulkValues.status}>
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* Platform */}
              <div className="min-w-[200px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Platform Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.platformId || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, platformId: val}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih Platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('platformId')} disabled={!bulkValues.platformId}>
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* CS */}
              <div className="min-w-[200px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set CS Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.csId || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, csId: val}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih CS..." />
                    </SelectTrigger>
                    <SelectContent>
                      {csUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('csId')} disabled={!bulkValues.csId}>
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* Advertiser */}
              <div className="min-w-[200px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Advertiser Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.advertiserId || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, advertiserId: val}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih Advertiser..." />
                    </SelectTrigger>
                    <SelectContent>
                      {advertisers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('advertiserId')} disabled={!bulkValues.advertiserId}>
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* Teknisi */}
              <div className="min-w-[200px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Teknisi Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.technicianId || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, technicianId: val}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih Teknisi..." />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('technicianId')} disabled={!bulkValues.technicianId}>
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* Cabang */}
              <div className="min-w-[200px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Cabang Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.branchId || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, branchId: val}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih Cabang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('branchId')} disabled={!bulkValues.branchId}>
                    Terapkan
                  </Button>
                </div>
              </div>

              {/* Area */}
              <div className="min-w-[200px] space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Area Massal</label>
                <div className="flex gap-2">
                  <Select 
                    value={bulkValues.areaId || ''} 
                    onValueChange={(val) => setBulkValues(prev => ({...prev, areaId: val}))}
                  >
                    <SelectTrigger className="w-full h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Pilih Area..." />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-3 bg-white hover:bg-slate-50 text-xs" onClick={() => handleBulkApply('areaId')} disabled={!bulkValues.areaId}>
                    Terapkan
                  </Button>
                </div>
              </div>
           </div>
        </div>

        {/* Editable Table */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[50vh] bg-white shadow-sm">
          <div className="overflow-auto flex-1 relative">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm border-b border-slate-200">
                <TableRow className="hover:bg-transparent border-slate-200">
                  <TableHead className="w-[50px] text-slate-500 font-semibold sticky left-0 z-20 bg-white uppercase text-[11px] tracking-wider text-center">No</TableHead>
                  <TableHead className="min-w-[130px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Tanggal Lead</TableHead>
                  <TableHead className="min-w-[160px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Customer</TableHead>
                  <TableHead className="min-w-[130px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">No HP</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Platform</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">CS</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Advertiser</TableHead>
                  <TableHead className="min-w-[200px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Layanan</TableHead>
                  <TableHead className="min-w-[130px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Tgl Service</TableHead>
                  <TableHead className="min-w-[100px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Jam</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Kendaraan</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Teknisi</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Cabang</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Area</TableHead>
                  <TableHead className="min-w-[180px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Catatan</TableHead>
                  <TableHead className="min-w-[150px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Harga (Rp)</TableHead>
                  <TableHead className="min-w-[140px] text-slate-500 font-semibold uppercase text-[11px] tracking-wider">Status</TableHead>
                  <TableHead className="w-[50px] sticky right-0 z-20 bg-white uppercase text-[11px] tracking-wider"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((order, idx) => (
                  <TableRow key={order.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100">
                    <TableCell className="text-sm text-slate-600 text-center font-medium sticky left-0 z-10 bg-white">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="date" 
                        value={order.leadDate} 
                        onChange={(e) => handleUpdateRow(idx, 'leadDate', e.target.value)}
                        className="h-9 text-xs w-full bg-white border-slate-200"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="text" 
                        value={order.customerName} 
                        onChange={(e) => handleUpdateRow(idx, 'customerName', e.target.value)}
                        className="h-9 text-xs font-medium bg-white border-slate-200"
                        placeholder="Nama Customer"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="text" 
                        value={order.customerPhone} 
                        onChange={(e) => handleUpdateRow(idx, 'customerPhone', e.target.value)}
                        className="h-9 text-xs font-mono bg-white border-slate-200"
                        placeholder="08..."
                      />
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(platforms, order.platformId) ? order.platformId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'platformId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.platformId && !isValidOption(platforms, order.platformId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.platformId || "Platform"} />
                        </SelectTrigger>
                        <SelectContent>
                          {platforms.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(csUsers, order.csId) ? order.csId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'csId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.csId && !isValidOption(csUsers, order.csId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.csId || "CS"} />
                        </SelectTrigger>
                        <SelectContent>
                          {csUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(advertisers, order.advertiserId) ? order.advertiserId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'advertiserId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.advertiserId && !isValidOption(advertisers, order.advertiserId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.advertiserId || "Advertiser"} />
                        </SelectTrigger>
                        <SelectContent>
                          {advertisers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(services, order.serviceId) ? order.serviceId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'serviceId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.serviceId && !isValidOption(services, order.serviceId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.serviceId || "Pilih Layanan"} />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="date" 
                        value={order.serviceDate} 
                        onChange={(e) => handleUpdateRow(idx, 'serviceDate', e.target.value)}
                        className="h-9 text-xs w-full bg-white border-slate-200"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="time" 
                        value={order.serviceTime} 
                        onChange={(e) => handleUpdateRow(idx, 'serviceTime', e.target.value)}
                        className="h-9 text-xs w-full bg-white border-slate-200"
                      />
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(vehicles, order.vehicleId) ? order.vehicleId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'vehicleId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.vehicleId && !isValidOption(vehicles, order.vehicleId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.vehicleId && !isValidOption(vehicles, order.vehicleId) ? order.vehicleId : "Kendaraan"} />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(technicians, order.technicianId) ? order.technicianId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'technicianId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.technicianId && !isValidOption(technicians, order.technicianId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.technicianId || "Teknisi"} />
                        </SelectTrigger>
                        <SelectContent>
                          {technicians.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(branches, order.branchId) ? order.branchId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'branchId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.branchId && !isValidOption(branches, order.branchId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.branchId || "Cabang"} />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={isValidOption(areas, order.areaId) ? order.areaId : undefined} 
                        onValueChange={(val) => handleUpdateRow(idx, 'areaId', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full bg-white ${order.areaId && !isValidOption(areas, order.areaId) ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200'}`}>
                          <SelectValue placeholder={order.areaId || "Area"} />
                        </SelectTrigger>
                        <SelectContent>
                           {areas
                             .filter(a => !order.branchId || a.branchId === order.branchId)
                             .map(a => (
                               <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="text" 
                        value={order.notes} 
                        onChange={(e) => handleUpdateRow(idx, 'notes', e.target.value)}
                        className="h-9 text-xs font-mono bg-white border-slate-200"
                        placeholder="Catatan..."
                      />
                    </TableCell>
                    <TableCell>
                       <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-medium">Rp</span>
                          <Input 
                            type="text"
                            value={Number(order.price).toLocaleString('id-ID')} 
                            onChange={(e) => {
                                const val = formatCurrencyInput(e.target.value);
                                handleUpdateRow(idx, 'price', parseInt(val || '0'));
                            }}
                            className={`h-9 text-xs font-mono pl-8 text-right bg-white border-slate-200 ${!isValidPrice(order.price) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          />
                       </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={order.status} 
                        onValueChange={(val) => handleUpdateRow(idx, 'status', val)}
                      >
                        <SelectTrigger className={`h-9 text-xs w-full border-0 font-medium ${getStatusColor(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Terjadwal</SelectItem>
                          <SelectItem value="processing">Proses</SelectItem>
                          <SelectItem value="done">Selesai</SelectItem>
                          <SelectItem value="reschedule">Reschedule</SelectItem>
                          <SelectItem value="cancelled">Batal</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 bg-white">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                        onClick={() => handleRemoveRow(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                   <TableRow>
                      <TableCell colSpan={18} className="text-center py-16 text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                             <Calculator className="w-8 h-8 opacity-20" />
                             <p>Tidak ada data untuk ditampilkan</p>
                          </div>
                      </TableCell>
                   </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Controls */}
          <div className="border-t border-slate-200 p-3 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                   <div className="flex items-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      >
                         &lt;
                      </Button>
                      <div className="flex items-center justify-center min-w-[32px] font-medium text-slate-700">
                        {currentPage}
                      </div>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-slate-400 mr-2">{totalPages}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100" 
                        disabled={currentPage === totalPages || totalPages === 0}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      >
                         &gt;
                      </Button>
                   </div>
              </div>
              
              <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500">Tampilkan:</span>
                  <Select 
                     value={itemsPerPage.toString()} 
                     onValueChange={(val) => {
                         setItemsPerPage(Number(val));
                         setCurrentPage(1);
                     }}
                  >
                      <SelectTrigger className="w-[140px] h-8 text-xs bg-white border border-blue-200 hover:border-blue-300 focus:ring-blue-200 text-slate-700 rounded-md shadow-sm">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                          <SelectItem value="50">50 / Halaman</SelectItem>
                          <SelectItem value="100">100 / Halaman</SelectItem>
                          <SelectItem value="200">200 / Halaman</SelectItem>
                          <SelectItem value="300">300 / Halaman</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2">
            <div className="text-sm text-slate-500">
                <span className="font-medium text-slate-900">{data.length} Pesanan</span> siap disimpan
            </div>
            <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="h-10 px-6">
                    Batal
                </Button>
                <Button onClick={handleSubmit} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Simpan Semua
                </Button>
            </div>
        </div>
      </div>
    </Modal>
  );
}
