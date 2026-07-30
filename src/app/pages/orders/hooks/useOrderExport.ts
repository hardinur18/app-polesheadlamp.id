import { useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { Order } from '../../master-data/data';
import { getStatusLabel } from '../orderHelpers';

interface UseOrderExportParams {
  filteredOrders: Order[];
  users: any[];
  services: any[];
  vehicles: any[];
  branches: any[];
  areas: any[];
  platforms: any[];
  payments: any[];
}

export function useOrderExport({
  filteredOrders,
  users,
  services,
  vehicles,
  branches,
  areas,
  platforms,
  payments,
}: UseOrderExportParams) {

  const getExportData = useCallback(() => {
    const formatDate = (date: string) => {
      if (!date) return '';
      try {
        return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch (e) {
        return date;
      }
    };

    const headers = [
      "ID Order", "Tanggal Lead", "Nama Customer", "No HP", "Alamat",
      "Tanggal Service", "Jam Service", "Layanan", "Kategori Layanan",
      "Kendaraan", "Harga", "Platform", "CS", "Advertiser", "Catatan",
      "Teknisi", "Cabang", "Area", "Status Order", "Tipe Pembayaran",
      "Metode Pembayaran", "Status Pembayaran", "Validasi Pembayaran",
      "Income", "Affiliate"
    ];

    const data = filteredOrders.map(order => {
      const technician = users.find(u => u.id === order.technicianId);
      const cs = users.find(u => u.id === order.csId);
      const advertiser = users.find(u => u.id === order.advertiserId);
      const service = services.find(s => s.id === order.serviceId);
      const vehicle = vehicles.find(v => v.id === order.vehicleId);
      const branch = branches.find(b => b.id === order.branchId);
      const area = areas.find(a => a.id === order.areaId);
      const platform = platforms.find(p => p.id === order.platformId);
      const paymentMethod = payments.find(p => p.id === order.paymentMethodId);

      const rawStatus = order.status;
      const customStatus = (order.photos as any)?._status;
      const effectiveStatus = customStatus && (rawStatus === 'processing' || rawStatus === 'pending') ? customStatus : rawStatus;

      return [
        order.id,
        formatDate(order.leadDate || ''),
        order.customerName,
        order.customerPhone ? `'${order.customerPhone}` : '',
        order.address,
        formatDate(order.serviceDate),
        order.serviceTime,
        service?.name || order.serviceId || '',
        order.serviceCategory,
        vehicle?.name || order.vehicleId || '',
        order.price,
        platform?.name || order.platformId || '',
        cs?.name || order.csId || '',
        advertiser?.name || order.advertiserId || '',
        order.notes,
        technician?.name || order.technicianId || '',
        branch?.name || order.branchId || '',
        area?.name || order.areaId || '',
        getStatusLabel(effectiveStatus),
        order.paymentType,
        paymentMethod?.bankName || order.paymentMethodId || '',
        order.paymentStatus,
        order.paymentValidation,
        order.income,
        order.affiliateName
      ];
    });

    return { headers, data };
  }, [filteredOrders, users, services, vehicles, branches, areas, platforms, payments]);

  const handleExportCSV = useCallback(() => {
    const { headers, data } = getExportData();
    const csv = Papa.unparse({ fields: headers, data });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_Pesanan_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Data berhasil diexport ke CSV");
  }, [getExportData]);

  const handleExportXLSX = useCallback(() => {
    const { headers, data } = getExportData();
    const wsData = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pesanan");
    XLSX.writeFile(wb, `Data_Pesanan_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`);
    toast.success("Data berhasil diexport ke Excel");
  }, [getExportData]);

  const handleExportPDF = useCallback(() => {
    const { headers, data } = getExportData();
    const doc = new jsPDF({ orientation: 'landscape' });

    autoTable(doc, {
      head: [headers],
      body: data,
      styles: { fontSize: 6 },
      headStyles: { fillColor: [22, 163, 74] },
    });

    doc.save(`Data_Pesanan_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.pdf`);
    toast.success("Data berhasil diexport ke PDF");
  }, [getExportData]);

  const handleDownloadTemplate = useCallback(() => {
    const templateData = [
      {
        "Tanggal Lead": "2025-01-01",
        "Nama Customer": "Budi Santoso",
        "No HP": "08123456789",
        "Alamat": "Jl. Sudirman No. 1",
        "Maps URL": "https://maps.google.com/?q=-6.2088,106.8456",
        "Tanggal Service": "2025-01-02",
        "Jam Service": "10:00",
        "Layanan": "Nano Ceramic",
        "Kategori Layanan": "Home Service",
        "Kendaraan": "Avanza",
        "Harga": 1500000,
        "Platform": "Instagram",
        "CS": "Admin 1",
        "Advertiser": "Adv 1",
        "Catatan": "Mobil warna hitam",
        "Teknisi": "Teknisi A",
        "Cabang": "Jakarta Selatan",
        "Area": "Jakarta",
        "Status Order": "Terjadwal",
        "Tipe Pembayaran": "Transfer",
        "Metode Pembayaran": "BCA",
        "Status Pembayaran": "Unpaid",
        "Validasi Pembayaran": "Pending",
        "Income": 1500000,
        "Affiliate": "Bengkel A"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Pesanan.xlsx");
    toast.success("Template Excel berhasil didownload");
  }, []);

  return {
    handleExportCSV,
    handleExportXLSX,
    handleExportPDF,
    handleDownloadTemplate,
  };
}
