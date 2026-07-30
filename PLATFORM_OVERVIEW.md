# Legacy Overview

Dokumentasi yang sudah diperbarui ada di `APP_OVERVIEW.md`.

---

# Polesheadlamp.id - Platform Operasional Enterprise

## 🎨 Design System

### Tema Biru Laut (Ocean Theme)
- **Primary Navy**: #0B1F3B
- **Secondary Teal**: #0E7490
- **Accent Sky**: #38BDF8
- **Background**: #F6F9FC
- **Surface**: #FFFFFF

### Status Colors
- 🔘 **Belum Dikerjakan** (Pending): #9CA3AF
- 🔵 **Mengerjakan** (Processing): #3B82F6
- ✅ **Selesai** (Completed): #10B981
- ❌ **Batal** (Cancelled): #EF4444
- ⏳ **Menunggu** (Waiting): #F59E0B

### Typography
- **Heading**: Sora (600 weight)
- **Body**: Manrope (400-500 weight)

### Layout
- **Sidebar**: 240px fixed, gradient navy-teal
- **Topbar**: 64px height, white background
- **Grid**: 12 kolom
- **Spacing**: 8/12/16/24/32/48px

---

## 🏗️ Struktur Platform

### 1. **Authentication**
- ✅ Login dengan role selection
- ✅ 8 role berbeda (Pemilik, PIC, CS, Pengiklan, Teknisi, Keuangan, Gudang, Pembaca)
- ✅ Demo login untuk setiap role

### 2. **Dashboard (Beranda)**
- ✅ KPI Cards: Cost, CPR Dashboard, CPR Real, GMV
- ✅ Grafik: Biaya per tanggal, CPR comparison
- ✅ Tabel: Jadwal hari ini, pembayaran tertunda
- ✅ Real-time stats

### 3. **Iklan Harian (Pengiklan)**
- ✅ Tabel komprehensif: Tanggal, Platform, Belanja, Tayangan, Klik, Prospek, Pesanan, Selesai, CPR
- ✅ Form CRUD lengkap
- ✅ Summary cards
- ✅ Filter periode
- ✅ Export functionality

### 4. **Kotak Masuk Prospek (CS)**
- ✅ Tabel prospek dengan detail lengkap
- ✅ Drawer detail dengan timeline aktivitas
- ✅ Quick actions: Call, WhatsApp
- ✅ Konversi prospek → pesanan
- ✅ Form CRUD lengkap

### 5. **Pesanan/Layanan (CS + PIC)**
- ✅ Tabel pesanan komprehensif
- ✅ Pratinjau rute otomatis dengan peta
- ✅ Estimasi jarak & waktu
- ✅ Status tracking
- ✅ Form CRUD lengkap

### 6. **View Teknisi (Role: Teknisi)**
- ✅ Map-first interface
- ✅ Rute otomatis 1-5 pesanan
- ✅ Tombol: Mulai, Selesai, Hubungi
- ✅ Upload foto sebelum/sesudah
- ✅ Upload bukti pembayaran (opsional)
- ✅ Progress tracking
- ✅ Status real-time

### 7. **Pemantauan Lapangan (PIC)**
- ✅ Peta real-time semua teknisi
- ✅ Status cards per teknisi
- ✅ Progress bar
- ✅ Last update tracking
- ✅ Drawer detail lengkap
- ✅ Timeline aktivitas

### 8. **Keuangan - Kas Masuk/Keluar**
- ✅ Tabel transaksi
- ✅ Summary: Total masuk, keluar, saldo
- ✅ Form CRUD lengkap
- ✅ Kategori terstruktur
- ✅ Filter & export

### 9. **Master Data**
- ✅ Multi-tab interface:
  - Teknisi
  - Customer Service
  - Cabang
  - Daerah
  - Sumber Prospek
  - Jenis Layanan
  - Metode Pembayaran
  - Tipe Mobil
- ✅ Form CRUD untuk setiap kategori
- ✅ Badge & status indicators

### 10. **Laporan (Analytics)**
- ✅ Summary stats komprehensif
- ✅ Grafik: Revenue trend, Service distribution, Technician performance
- ✅ Tabel performa bulanan
- ✅ Export PDF
- ✅ Filter periode

### 11. **Design System Page**
- ✅ Dokumentasi warna lengkap
- ✅ Typography showcase
- ✅ Semua komponen UI
- ✅ Interactive examples
- ✅ Grid & spacing guide

---

## 🧩 Komponen UI (Design System)

### Core Components
- ✅ **Button**: 5 variants (primary, secondary, ghost, danger, success), 3 sizes
- ✅ **Input**: Label, error states, icons, helper text
- ✅ **Select**: Dropdown dengan ChevronDown icon
- ✅ **Badge**: 5 status types dengan dots & colors
- ✅ **KPICard**: Icon, value, change percentage, trend
- ✅ **Upload**: Drag & drop, preview, multiple files
- ✅ **Modal**: Sizes (sm, md, lg, xl, full), header, footer
- ✅ **Drawer**: Left/right position, sizes
- ✅ **FilterBar**: Period tabs, custom date, branch select, status chips
- ✅ **MapCard**: Route visualization, pins, legend, tooltips

### Layout Components
- ✅ **Sidebar**: Role-based menu, gradient background, active states
- ✅ **Topbar**: Search, notifications, user menu

---

## 🔄 Otomatisasi & Sinkronisasi

### Rute Otomatis
- ✅ Berdasarkan jam order (paling awal → paling akhir)
- ✅ Jarak terdekat dari lokasi sebelumnya
- ✅ Estimasi waktu tempuh
- ✅ Pratinjau untuk CS sebelum assign

### Status Otomatis
- ✅ Foto sebelum → Status "Mengerjakan"
- ✅ Foto sesudah → Status "Selesai"
- ✅ Bukti pembayaran → Sinkron ke Kas & status Lunas

### Real-time Sync
- ✅ Perubahan status teknisi → Update peta
- ✅ Upload foto → Update progress
- ✅ Pembayaran → Update kas & dashboard

---

## 👥 Role-based Access Control

### Pemilik (Full Access)
Akses ke semua menu dan fitur

### PIC/Super Admin
Semua operasional kecuali view teknisi

### Customer Service (CS)
- Dashboard
- Prospek
- Pesanan
- Kalender

### Pengiklan
- Dashboard
- Iklan Harian
- Laporan

### Teknisi
- Dashboard
- View Teknisi (map-first)
- Kalender

### Keuangan
- Dashboard
- Kas
- Hutang/Piutang
- Laporan

### Gudang
- Dashboard
- Inventaris
- Pembelian
- Laporan

### Pembaca
- Dashboard
- Laporan (read-only)

---

## 📱 Responsive Design

- ✅ **Desktop**: 1440px optimal
- ✅ **Tablet**: 768px - 1024px
- ✅ **Mobile**: 390px (view teknisi optimized)

---

## 📋 Form CRUD Lengkap

Semua form memiliki:
- ✅ Validasi required fields
- ✅ Error states
- ✅ Success feedback
- ✅ Cancel & Save actions
- ✅ Modal/Drawer integration

### Forms Available:
1. **Iklan Harian**: Tanggal, platform, belanja, tayangan, klik
2. **Prospek**: Nama, HP, sumber, status, catatan
3. **Pesanan**: Jadwal, jam, jenis layanan, lokasi, peta, harga, teknisi, status
4. **Progres Teknisi**: Status, foto sebelum/sesudah, bukti pembayaran, GPS
5. **Kas**: Kategori, pemasukan/pengeluaran, jumlah, penerima/pembayar
6. **Master Data**: Teknisi, CS, Cabang, Layanan, dll.

---

## 🎯 Fitur Unggulan

### 1. Map Integration
- ✅ Visual route planning
- ✅ Color-coded status pins
- ✅ Interactive tooltips
- ✅ Legend & distance indicators

### 2. Photo Upload
- ✅ Drag & drop interface
- ✅ Preview thumbnails
- ✅ Multiple file support
- ✅ Required/optional validation

### 3. Analytics Dashboard
- ✅ Recharts integration
- ✅ Line, Bar, Pie charts
- ✅ Interactive tooltips
- ✅ Real-time data

### 4. Filter System
- ✅ Period: Hari Ini, Bulan, Tahun, Semua, Kustom
- ✅ Branch multi-select
- ✅ Status chips (removable)
- ✅ Sticky positioning

---

## 🚀 Tech Stack

- **Framework**: React 18.3.1
- **Build**: Vite 6.3.5
- **Styling**: Tailwind CSS 4.1.12
- **Charts**: Recharts 2.15.2
- **Icons**: Lucide React 0.487.0
- **Typography**: Google Fonts (Sora, Manrope)

---

## 📦 Halaman yang Tersedia

✅ **Lengkap & Fungsional**:
1. Login (8 role quick access)
2. Dashboard (Beranda)
3. Iklan Harian
4. Kotak Masuk Prospek
5. Pesanan/Layanan
6. View Teknisi
7. Pemantauan Lapangan
8. Kas Masuk/Keluar
9. Master Data
10. Laporan
11. Design System

📋 **Placeholder** (struktur siap, konten akan dilengkapi):
- Penugasan Teknisi
- Kalender Jadwal
- Peta Semua Klien
- Hutang/Piutang
- Inventaris
- Pembelian
- Pengguna & Akses

---

## 🎨 Konsistensi Visual

- ✅ Semua halaman menggunakan komponen dari Design System
- ✅ Warna konsisten (navy + teal theme)
- ✅ Typography hierarchy jelas
- ✅ Spacing grid 8pt
- ✅ Border radius konsisten (8-24px)
- ✅ Shadow levels terstruktur

---

## 💡 Cara Menggunakan

### Login
1. Pilih role dari quick access panel
2. Atau input manual (username/password bebas untuk demo)
3. Klik "Masuk dengan Demo" untuk auto-fill

### Navigasi
- Sidebar: Menu utama per role
- Topbar: Search, notifikasi, user menu
- Filter bar: Periode & status filter

### CRUD Operations
- **Create**: Klik tombol "+ Tambah"
- **Read**: Data di tabel, klik row untuk detail
- **Update**: Tombol edit (icon pensil)
- **Delete**: Tombol delete (icon trash)

---

## 📝 Notes

Platform ini adalah **prototype fungsional** dengan:
- ✅ UI/UX profesional enterprise-grade
- ✅ Role-based access control
- ✅ Responsive design
- ✅ Interactive components
- ✅ Mock data untuk demo

Untuk production:
- Integrasikan dengan backend API
- Tambahkan authentication real
- Implementasi database
- Setup maps API (Google Maps/Mapbox)
- Enable real-time sync (WebSocket/Firebase)

---

**Dibuat dengan**: React + Tailwind CSS + Recharts + Lucide Icons  
**Tema**: Ocean Blue (Navy + Teal)  
**Font**: Sora + Manrope  
**Grid**: 12 kolom, spacing 24px
