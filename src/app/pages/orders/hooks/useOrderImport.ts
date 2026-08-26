import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Order } from '../../master-data/data';
import {
  isAdvertiserRole,
  isCsRole,
  isTechnicianRole,
} from '@/app/data/roleHelpers';
import { normalizeOrderTime } from '@/app/services/orderTime';

const loadCsvParser = async () => (await import('papaparse')).default;
const loadSpreadsheet = async () => import('xlsx');

interface UseOrderImportParams {
  users: any[];
  services: any[];
  vehicles: any[];
  branches: any[];
  areas: any[];
  platforms: any[];
  payments: any[];
  addOrder: (order: any) => any;
}

export function useOrderImport({
  users,
  services,
  vehicles,
  branches,
  areas,
  platforms,
  payments,
  addOrder,
}: UseOrderImportParams) {
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<Order[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleConfirmImport = useCallback(async (confirmedData: Order[]) => {
    if (confirmedData.length === 0) return;

    let savedCount = 0;
    let saveErrors = 0;
    const failureDetails: string[] = [];

    const toastId = toast.loading("Menyimpan data...");
    setIsImportPreviewOpen(false);

    for (const order of confirmedData) {
      try {
        // @ts-ignore
        await addOrder(order);
        savedCount++;
      } catch (err: any) {
        console.error("Failed to save order", order, err);
        saveErrors++;
        failureDetails.push(`${order.customerName}: ${err?.message || 'Gagal disimpan'}`);
      }
    }

    toast.dismiss(toastId);

    if (savedCount > 0) {
      toast.success(`Berhasil mengimport ${savedCount} pesanan.`, {
        description: saveErrors > 0 ? `${saveErrors} gagal disimpan.` : "Data telah tersimpan di database."
      });
    } else if (saveErrors > 0) {
      toast.error(`Gagal mengimport pesanan.`, {
        description: failureDetails.slice(0, 2).join(' | ') || "Terjadi kesalahan saat menyimpan data."
      });
    }
    if (savedCount > 0 && saveErrors > 0) {
      toast.error(`${saveErrors} pesanan gagal diimport`, {
        description: failureDetails.slice(0, 2).join(' | '),
      });
    }

    setImportPreviewData([]);
  }, [addOrder]);

  const handleImportOrders = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    const processRows = async (rows: any[]) => {
      const newOrders: Order[] = [];

      for (const row of rows) {
        try {
          const getValue = (key: string) => {
            const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
            const val = foundKey ? row[foundKey] : undefined;
            return typeof val === 'string' ? val.trim() : val;
          };

          const findId = (list: any[], name: any) => {
            if (!name) return undefined;
            const strName = String(name).trim();
            if (!strName) return undefined;
            return list.find(item => item.name?.toLowerCase() === strName.toLowerCase())?.id || strName;
          };

          const parseDate = (val: any) => {
            if (!val) return new Date().toISOString().split('T')[0];
            try {
              if (val instanceof Date) {
                const offset = val.getTimezoneOffset() * 60000;
                const localDate = new Date(val.getTime() - offset);
                return localDate.toISOString().split('T')[0];
              }
              if (typeof val === 'string') {
                const dmyMatch = val.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
                if (dmyMatch) {
                  const [_, d, m, y] = dmyMatch;
                  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn("Date parse error", val);
            }
            return new Date().toISOString().split('T')[0];
          };

          const parsePrice = (val: any) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            let str = String(val);
            if (str.includes('.') && !str.includes(',')) {
              str = str.replace(/\./g, '');
            } else if (str.includes('.') && str.includes(',')) {
              str = str.replace(/\./g, '').replace(',', '.');
            }
            const cleanStr = str.replace(/[^0-9.]/g, '');
            const num = parseFloat(cleanStr);
            return isNaN(num) ? 0 : num;
          };

          const generateOrderId = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = 'OP-';
            for (let i = 0; i < 5; i++) {
              result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
          };

          const parseTime = (val: any) => {
            return normalizeOrderTime(val, "09:00");
          };

          const technicianId = findId(users.filter((u) => isTechnicianRole(u.role)), getValue("Teknisi"));
          const csId = findId(users.filter((u) => isCsRole(u.role)), getValue("CS"));
          const advertiserId = findId(users.filter((u) => isAdvertiserRole(u.role)), getValue("Advertiser"));
          const serviceId = findId(services, getValue("Layanan"));
          const vehicleId = findId(vehicles, getValue("Kendaraan"));
          const branchId = findId(branches, getValue("Cabang"));
          const areaId = findId(areas, getValue("Area"));
          const platformId = findId(platforms, getValue("Platform"));
          const paymentMethodName = getValue("Metode Pembayaran");
          const paymentMethodId = payments.find(p => p.bankName?.toLowerCase() === String(paymentMethodName).toLowerCase())?.id;

          const getStatusCode = (label: string) => {
            const l = String(label || '').toLowerCase();
            if (l === 'terjadwal' || l === 'pending') return 'pending';
            if (l === 'selesai' || l === 'done') return 'done';
            if (l === 'jadwal ulang' || l === 'reschedule') return 'reschedule';
            if (l === 'cancel' || l === 'cancelled') return 'cancelled';
            if (l === 'proses' || l === 'processing') return 'processing';
            if (l === 'otw jalan' || l === 'otw' || l === 'on_the_way') return 'otw';
            if (l === 'pengerjaan' || l === 'working') return 'working';
            if (l === 'menunggu qc' || l === 'qc' || l === 'teknisi_completed') return 'qc';
            return 'pending';
          };

          const order: any = {
            id: getValue("ID") || generateOrderId(),
            created_at: new Date().toISOString(),
            leadDate: parseDate(getValue("Tanggal Lead")),
            customerName: getValue("Nama Customer") || "Unknown",
            customerPhone: getValue("No HP") || "",
            address: getValue("Alamat") || "",
            mapsUrl: getValue("Maps URL") || "",
            serviceDate: parseDate(getValue("Tanggal Service")),
            serviceTime: parseTime(getValue("Jam Service")),
            serviceId: serviceId,
            serviceCategory: getValue("Kategori Layanan") || "Visit",
            vehicleId: vehicleId,
            price: parsePrice(getValue("Harga")),
            platformId: platformId,
            csId: csId,
            advertiserId: advertiserId,
            notes: getValue("Catatan") || "",
            technicianId: technicianId,
            branchId: branchId,
            areaId: areaId,
            status: getStatusCode(getValue("Status Order")),
            paymentType: getValue("Tipe Pembayaran") || "Transfer",
            paymentMethodId: paymentMethodId,
            paymentStatus: (getValue("Status Pembayaran") || "Unpaid") as any,
            paymentValidation: (getValue("Validasi Pembayaran") || "Pending") as any,
            income: parsePrice(getValue("Income")),
            affiliateName: getValue("Affiliate") || ""
          };

          newOrders.push(order);
        } catch (e) {
          console.error("Error parsing row", row, e);
        }
      }

      if (newOrders.length > 0) {
        setImportPreviewData(newOrders);
        setIsImportPreviewOpen(true);
      } else {
        toast.warning("Tidak ada data valid yang ditemukan untuk diimport.");
      }
    };

    if (file.name.match(/\.csv$/i)) {
      try {
        const Papa = await loadCsvParser();
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            await processRows(results.data as any[]);
          },
          error: (error) => {
            console.error("Error reading CSV file:", error);
            toast.error("Gagal membaca file CSV.");
          },
        });
      } catch (error) {
        console.error("Error loading CSV parser:", error);
        toast.error("Gagal menyiapkan import CSV.");
      }
    } else if (file.name.match(/\.(xlsx|xls)$/i)) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        try {
          const XLSX = await loadSpreadsheet();
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { cellDates: true } as any);
          await processRows(rows);
        } catch (error) {
          console.error("Error reading Excel file:", error);
          toast.error("Gagal membaca file Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Format file tidak didukung. Harap gunakan .csv atau .xlsx");
    }
  }, [users, services, vehicles, branches, areas, platforms, payments]);

  return {
    isImportPreviewOpen, setIsImportPreviewOpen,
    importPreviewData, setImportPreviewData,
    fileInputRef,
    handleImportClick,
    handleConfirmImport,
    handleImportOrders,
  };
}
