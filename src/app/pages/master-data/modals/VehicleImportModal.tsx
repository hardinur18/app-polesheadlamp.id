import React, { useState, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../../components/ui/select";
import { CheckCircle2, Trash2, Upload, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { VehicleType } from '../data';
import { getVehicleNameValidationMessage, normalizeVehicleName } from '../vehicleValidation';

interface VehicleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (vehicles: Partial<VehicleType>[]) => Promise<void>;
}

export function VehicleImportModal({ isOpen, onClose, onConfirm }: VehicleImportModalProps) {
  const [data, setData] = useState<Partial<VehicleType>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Categories based on GenericForm
  const categories = [
    { value: 'small', label: 'Small (City Car)' },
    { value: 'medium', label: 'Medium (MPV/Sedan)' },
    { value: 'large', label: 'Large (SUV)' },
    { value: 'luxury', label: 'Luxury / Big MPV' },
    { value: 'motor', label: 'Motorcycle' }
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input
    event.target.value = '';

    const processRows = (rows: any[]) => {
      const newVehicles: Partial<VehicleType>[] = [];
      
      rows.forEach((originalRow: any) => {
        // Normalize keys (lowercase & trim) for more robust matching
        const row: any = {};
        Object.keys(originalRow).forEach(k => {
            row[String(k).trim().toLowerCase()] = originalRow[k];
        });

        // Try to map fields flexibly
        const nameKeys = ['name', 'nama', 'tipe mobil', 'tipe', 'vehicle name', 'merk', 'model', 'brand', 'nama mobil', 'jenis mobil', 'unit'];
        const categoryKeys = ['category', 'kategori', 'jenis', 'kelas', 'class', 'ukuran', 'size', 'group'];
        
        const nameKey = nameKeys.find(k => row[k]);
        const name = nameKey ? normalizeVehicleName(row[nameKey]) : '';

        const categoryKey = categoryKeys.find(k => row[k]);
        const categoryRaw = categoryKey ? row[categoryKey] : '';
        
        const statusRaw = row['status'] || 'active';

        // Map category if possible
        let category = '';
        const c = String(categoryRaw).toLowerCase();
        if (c.includes('small') || c.includes('city') || c.includes('kecil') || c.includes('lcgc') || c.includes('compact') || c.includes('hatchback')) category = 'small';
        else if (c.includes('medium') || c.includes('mpv') || c.includes('sedan') || c.includes('sedang') || c.includes('family')) category = 'medium';
        else if (c.includes('large') || c.includes('suv') || c.includes('besar') || c.includes('jeep') || c.includes('4x4') || c.includes('pajero') || c.includes('fortuner')) category = 'large';
        else if (c.includes('luxury') || c.includes('big') || c.includes('mewah') || c.includes('alphard') || c.includes('vellfire') || c.includes('premium')) category = 'luxury';
        else if (c.includes('motor') || c.includes('bike') || c.includes('roda 2')) category = 'motor';
        else category = c; // Keep original if no match, validation will catch it

        if (name) {
           newVehicles.push({
             name: String(name).trim(),
             category: category,
             status: String(statusRaw).toLowerCase() === 'inactive' ? 'inactive' : 'active'
           });
        }
      });

      if (newVehicles.length > 0) {
        setData(newVehicles);
        const invalidNameCount = newVehicles.filter((vehicle) => getVehicleNameValidationMessage(vehicle.name)).length;
        if (invalidNameCount > 0) {
          toast.warning(`${newVehicles.length} data ditemukan, ${invalidNameCount} perlu dicek karena mirip chat/catatan customer.`);
        } else {
          toast.success(`${newVehicles.length} data ditemukan.`);
        }
      } else {
        toast.warning("Tidak ada data yang dapat dibaca. Pastikan format file benar.");
      }
    };

    if (file.name.match(/\.csv$/i)) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processRows(results.data)
      });
    } else if (file.name.match(/\.(xlsx|xls)$/i)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        processRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Format file tidak didukung.");
    }
  };

  const handleUpdateRow = (index: number, field: keyof VehicleType, value: any) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    setData(newData);
  };

  const handleRemoveRow = (index: number) => {
    setData(data.filter((_, i) => i !== index));
  };

  const isValidCategory = (cat?: string) => {
    return categories.some(c => c.value === cat);
  };

  const handleSubmit = async () => {
    // Validate
    const invalidCount = data.filter(v => getVehicleNameValidationMessage(v.name) || !isValidCategory(v.category)).length;
    if (invalidCount > 0) {
      toast.error(`Terdapat ${invalidCount} data yang belum valid (cek nama tipe mobil atau kategori).`);
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(data);
      onClose();
      setData([]);
    } catch (e) {
      console.error(e);
      toast.error("Gagal menyimpan data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
     const template = [
       { "Nama": "Avanza Veloz", "Kategori": "Medium", "Status": "Active" },
       { "Nama": "Pajero Sport", "Kategori": "Large", "Status": "Active" },
       { "Nama": "Honda Brio", "Kategori": "Small", "Status": "Active" }
     ];
     const ws = XLSX.utils.json_to_sheet(template);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Template");
     XLSX.writeFile(wb, "Template_Import_Mobil.xlsx");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Data Tipe Mobil"
      size="xl"
    >
      <div className="space-y-6">
        {data.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50 dark:bg-slate-800/50">
             <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8" />
             </div>
             <div>
               <h3 className="font-semibold text-slate-900 dark:text-slate-100">Upload File Excel / CSV</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                 Gunakan format .xlsx atau .csv untuk mengimport data tipe mobil.
               </p>
             </div>
             <div className="flex gap-3">
               <Button variant="outline" onClick={handleDownloadTemplate}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Download Template
               </Button>
               <Button onClick={() => fileInputRef.current?.click()}>
                  Pilih File
               </Button>
             </div>
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept=".csv, .xlsx, .xls" 
               onChange={handleFileChange}
             />
          </div>
        ) : (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-3 rounded-lg text-sm flex items-center justify-between border border-blue-100 dark:border-blue-800/30">
               <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Periksa kembali data sebelum disimpan. Pastikan kategori sesuai.</span>
               </div>
               <Button variant="ghost" size="sm" className="h-8 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={() => setData([])}>
                  Reset
               </Button>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[50vh] overflow-y-auto bg-white dark:bg-slate-900">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[50px] text-center">No</TableHead>
                    <TableHead>Nama Tipe Mobil</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center text-slate-500 dark:text-slate-400">{idx + 1}</TableCell>
                      <TableCell>
                        <Input 
                          value={item.name} 
                          onChange={(e) => handleUpdateRow(idx, 'name', e.target.value)}
                          className={getVehicleNameValidationMessage(item.name) ? "border-red-500 bg-red-50 text-red-700" : ""}
                        />
                        {getVehicleNameValidationMessage(item.name) && (
                          <p className="mt-1 text-[11px] text-red-600">
                            {getVehicleNameValidationMessage(item.name)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={isValidCategory(item.category) ? item.category : undefined} 
                          onValueChange={(val) => handleUpdateRow(idx, 'category', val)}
                        >
                          <SelectTrigger className={!isValidCategory(item.category) ? "border-red-500 text-red-600 bg-red-50" : ""}>
                            <SelectValue placeholder={item.category || "Pilih Kategori"} />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                         <Select 
                            value={item.status} 
                            onValueChange={(val) => handleUpdateRow(idx, 'status', val)}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Aktif</SelectItem>
                              <SelectItem value="inactive">Non Aktif</SelectItem>
                            </SelectContent>
                          </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleRemoveRow(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
               <Button variant="outline" onClick={onClose} disabled={isProcessing}>Batal</Button>
               <Button onClick={handleSubmit} disabled={isProcessing}>
                  {isProcessing ? "Menyimpan..." : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Simpan {data.length} Data
                    </>
                  )}
               </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
