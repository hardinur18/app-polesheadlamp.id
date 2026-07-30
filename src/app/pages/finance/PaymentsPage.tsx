import React, { useState } from 'react';
import { useMasterData } from '../master-data/context';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, Filter, Download, DollarSign, Calendar, Eye, MoreVertical, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Lock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

export const PaymentsPage = () => {
  const { orders } = useMasterData();
  const { hasPermission } = usePermissions();
  const canViewPayments = hasPermission('payments.view');
  const canManageFinance = hasPermission('finance.manage');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter Payments (derived from Orders)
  const payments = orders.filter(o => {
      const matchSearch = o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.paymentStatus === statusFilter;
      return matchSearch && matchStatus;
  });

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
          case 'Unpaid': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
          case 'Down Payment': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
          default: return 'bg-slate-100 text-slate-700 border-slate-200';
      }
  };

  const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  if (!canViewPayments) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-center p-8">
        <div className="bg-red-50 p-4 rounded-full text-red-600"><Lock className="w-12 h-12" /></div>
        <h1 className="text-2xl font-bold">Akses Dibatasi</h1>
        <p className="text-slate-500">Anda tidak memiliki izin untuk membuka halaman pembayaran.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto min-h-screen bg-slate-50/50 dark:bg-slate-950">
        <div className="flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                        Pembayaran
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Monitor status pembayaran tagihan pelanggan</p>
                    {!canManageFinance && (
                        <p className="text-xs text-amber-600 mt-2">Mode lihat saja. Konfirmasi pembayaran dan export dikunci.</p>
                    )}
                </div>
                <Button variant="outline" className="bg-white dark:bg-slate-800" disabled={!canManageFinance}>
                    <Download className="w-4 h-4 mr-2" /> Export Laporan
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pendapatan (Bulan Ini)</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Rp 45.200.000</h3>
                    </div>
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center text-emerald-600">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Menunggu Pembayaran</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Rp 12.500.000</h3>
                        <p className="text-xs text-red-500 mt-1 font-medium">8 Invoice Unpaid</p>
                    </div>
                    <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center text-red-600">
                        <Calendar className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Rata-rata Transaksi</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Rp 750.000</h3>
                    </div>
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600">
                        <Filter className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Content & Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Cari invoice / pelanggan..." 
                                className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700" 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="Paid">Lunas</SelectItem>
                                <SelectItem value="Unpaid">Belum Lunas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900">
                            <TableRow>
                                <TableHead className="py-4 pl-6">ID Invoice</TableHead>
                                <TableHead className="py-4">Tanggal</TableHead>
                                <TableHead className="py-4">Pelanggan</TableHead>
                                <TableHead className="py-4">Metode</TableHead>
                                <TableHead className="py-4 text-right">Jumlah</TableHead>
                                <TableHead className="py-4 text-center">Status</TableHead>
                                <TableHead className="py-4 pr-6 text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">Tidak ada data pembayaran ditemukan.</TableCell>
                                </TableRow>
                            ) : (
                                payments.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-700">
                                        <TableCell className="pl-6 font-medium text-slate-900 dark:text-slate-200">
                                            #{item.id}
                                        </TableCell>
                                        <TableCell className="text-slate-500 dark:text-slate-400 text-sm">
                                            {item.serviceDate ? format(new Date(item.serviceDate), 'dd MMM yyyy', { locale: id }) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900 dark:text-slate-200 text-sm">{item.customerName}</span>
                                                <span className="text-xs text-slate-500">{item.customerPhone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-normal">
                                                {item.paymentType || 'Transfer'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-700 dark:text-slate-300">
                                            {formatCurrency(item.price)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`font-semibold border ${getStatusColor(item.paymentStatus || 'Unpaid')}`}>
                                                {item.paymentStatus || 'Unpaid'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                    <DropdownMenuItem>
                                                        <Eye className="w-4 h-4 mr-2" /> Lihat Detail
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem disabled={!canManageFinance}>
                                                        <DollarSign className="w-4 h-4 mr-2" /> Konfirmasi Bayar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Card List */}
                <div className="md:hidden p-4 space-y-4">
                    {payments.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">Tidak ada data.</div>
                    ) : (
                        payments.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">#{item.id} • {item.serviceDate}</div>
                                        <h3 className="font-bold text-slate-900 dark:text-slate-100">{item.customerName}</h3>
                                    </div>
                                    <Badge variant="outline" className={`font-semibold border text-[10px] ${getStatusColor(item.paymentStatus || 'Unpaid')}`}>
                                        {item.paymentStatus || 'Unpaid'}
                                    </Badge>
                                </div>
                                
                                <div className="flex justify-between items-center py-3 border-t border-b border-slate-100 dark:border-slate-700 my-3">
                                    <span className="text-sm text-slate-500">Total Tagihan</span>
                                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.price)}</span>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1 text-xs h-9">Detail</Button>
                                    <Button className="flex-1 bg-blue-600 text-white text-xs h-9" disabled={!canManageFinance}>Bayar</Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
