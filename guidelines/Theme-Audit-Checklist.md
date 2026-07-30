# Theme Audit Checklist

Tanggal audit: 2026-04-07

## Status Saat Ini

- Toggle `light/dark` sudah tersedia dan terhubung di level app.
- Fondasi token tema sudah ada dan bisa dijadikan source of truth.
- Implementasi belum global ke seluruh fitur.
- Banyak halaman dan komponen masih memakai warna hardcoded `light-only`.
- Belum ada perubahan kode pada audit ini. File ini hanya daftar pekerjaan.

## Source Of Truth Yang Sudah Benar

Gunakan file-file ini sebagai acuan styling global:

- `src/styles/theme.css`
- `src/app/App.tsx`
- `src/app/components/layout/AppLayout.tsx`
- `src/app/components/ui/button.tsx`
- `src/app/components/ui/input.tsx`
- `src/app/components/ui/table.tsx`
- `src/app/components/ui/dialog.tsx`
- `src/app/components/ui/sheet.tsx`

## Temuan Inti

- Shell utama sudah theme-aware, tetapi banyak page content masih light-only.
- Warna font belum konsisten saat mode berubah karena masih banyak `text-slate-800`, `text-slate-900`, dan hex literal.
- Banyak `bg-white`, `border-slate-100`, `border-slate-200`, `bg-slate-50`, dan warna hex yang tidak punya pasangan dark mode.
- Ada beberapa komponen header/topbar duplikat yang styling-nya tidak seragam.
- `Toaster` memakai `theme=\"system\"`, sementara app theme diatur manual oleh toggle.

## Prioritas 1: Shell, Header, Dan Komponen Global

- [ ] `src/app/components/layout/Topbar.tsx`
  Light-only. Perlu mengikuti token tema global atau `dark:` variant.
- [ ] `src/app/components/layout/Header.tsx`
  Light-only. Masih memakai `bg-white`, `text-slate-*`, dan border light.
- [ ] `src/app/components/Topbar.tsx`
  Light-only dan berpotensi bikin UI tidak konsisten jika dipakai ulang.
- [ ] `src/app/components/Sidebar.tsx`
  Perlu audit penuh agar sinkron dengan mode gelap/terang di seluruh state.
- [ ] `src/app/components/FilterPeriod.tsx`
  Perlu cek warna panel, text, hover, dan border.
- [ ] `src/app/components/KPICard.tsx`
  Perlu cek background, angka utama, label, dan status color agar tetap kontras.
- [ ] `src/app/components/ui/FilterBar.tsx`
  Perlu diseragamkan ke token global.
- [ ] `src/app/components/ui/EmptyState.tsx`
  Perlu cek background, icon tone, dan secondary text.
- [ ] `src/app/components/ui/IndicatorBadge.tsx`
  Banyak warna hardcoded, perlu audit contrast di dark mode.
- [ ] `src/app/components/ui/StatusBadge.tsx`
  Perlu cek semua status badge agar readable di dark mode.
- [ ] `src/app/components/ui/Upload.tsx`
  Banyak hex literal. Ini salah satu komponen yang paling jelas belum theme-aware.
- [ ] `src/app/components/ui/alert-dialog.tsx`
  Masih ada surface light-only, perlu diselaraskan dengan token dialog utama.
- [ ] `src/app/components/ui/date-range-picker.tsx`
  Perlu cek input, panel, selected state, dan hover state.
- [ ] `src/app/components/ui/popover.tsx`
  Perlu validasi agar panel popover konsisten dengan warna global.

## Prioritas 2: Halaman Dengan Dampak Besar

File-file ini punya banyak warna hardcoded dan perlu dibenahi lebih dulu:

- [ ] `src/app/pages/Pesanan.tsx`
- [ ] `src/app/pages/Laporan.tsx`
- [ ] `src/app/pages/OwnerDashboard.tsx`
- [ ] `src/app/pages/IklanHarian.tsx`
- [ ] `src/app/pages/Pemantauan.tsx`
- [ ] `src/app/pages/Schedule.tsx`
- [ ] `src/app/pages/Prospek.tsx`
- [ ] `src/app/pages/TeknisiMobile.tsx`
- [ ] `src/app/pages/Kas.tsx`
- [ ] `src/app/pages/MonitoringPage.tsx`
- [ ] `src/app/pages/WATemplatesPage.tsx`
- [ ] `src/app/pages/advertiser/AdvertiserDashboard.tsx`
- [ ] `src/app/pages/ads/MarketingMonitoringPage.tsx`
- [ ] `src/app/pages/affiliates/AffiliateList.tsx`
- [ ] `src/app/pages/users/UserManagementPage.tsx`
- [ ] `src/app/pages/owner/OwnerAdsAnalytics.tsx`
- [ ] `src/app/pages/technician/TechnicianDashboard.tsx`
- [ ] `src/app/pages/orders/ImportPreviewModal.tsx`

## Prioritas 3: Halaman Dan Modul Yang Terindikasi Belum Global

File-file ini terdeteksi memakai warna light-only tanpa pasangan dark mode yang memadai:

- [ ] `src/app/pages/DesignSystem.tsx`
- [ ] `src/app/pages/affiliates/PublicBookingPage.tsx`
- [ ] `src/app/pages/finance/PaymentList.tsx`
- [ ] `src/app/pages/assignments/AssignmentList.tsx`
- [ ] `src/app/pages/leads/WATemplatesDialog.tsx`
- [ ] `src/app/pages/MobileTechnician.tsx`
- [ ] `src/app/pages/MasterData.tsx`
- [ ] `src/app/pages/master-data/AdvertiserReportPage.tsx`
- [ ] `src/app/pages/monitoring/TargetManager.tsx`
- [ ] `src/app/pages/Monitoring.tsx`
- [ ] `src/app/pages/PlaceholderPage.tsx`
- [ ] `src/app/pages/UserManagement.tsx`
- [ ] `src/app/pages/prospects/ProspectList.tsx`
- [ ] `src/app/pages/Reports.tsx`
- [ ] `src/app/pages/Login.tsx`
- [ ] `src/app/pages/users/UserAuditLog.tsx`
- [ ] `src/app/pages/users/UserForm.tsx`
- [ ] `src/app/pages/users/UserFormDialog.tsx`
- [ ] `src/app/pages/users/UserList.tsx`
- [ ] `src/app/pages/master-data/modals/VehicleImportModal.tsx`
- [ ] `src/app/pages/master-data/tabs/SourcesTab.tsx`
- [ ] `src/app/pages/master-data/tabs/RolesTab.tsx`

## Prioritas 4: Form Master Data

Form-form ini perlu dicek supaya input, label, dialog, dan helper text konsisten:

- [ ] `src/app/pages/master-data/forms/AdAccountForm.tsx`
- [ ] `src/app/pages/master-data/forms/AdSourceForm.tsx`
- [ ] `src/app/pages/master-data/forms/BranchForm.tsx`
- [ ] `src/app/pages/master-data/forms/TechnicianTeamForm.tsx`
- [ ] `src/app/pages/master-data/forms/AreaForm.tsx`
- [ ] `src/app/pages/master-data/forms/ServiceTypeForm.tsx`
- [ ] `src/app/pages/master-data/forms/GenericForm.tsx`

## Pola Yang Harus Dibereskan

- [ ] Ganti `bg-white`, `bg-slate-50`, `border-slate-100`, `border-slate-200`, dan `text-slate-*` yang masih hardcoded jika memang bagian itu harus ikut theme.
- [ ] Hindari warna hex literal untuk text dan surface jika bisa memakai token global.
- [ ] Standarkan text hierarchy:
  - judul utama
  - label
  - secondary text
  - placeholder
  - disabled text
- [ ] Pastikan card, dialog, dropdown, sheet, popover, table, dan empty state semua ikut mode aktif.
- [ ] Pastikan status badge tetap readable di dark mode.
- [ ] Pastikan hover, focus, active, selected, dan disabled state tetap kontras di kedua mode.
- [ ] Samakan gaya topbar/header agar tidak ada komponen light-only yang tertinggal.
- [ ] Sinkronkan toast theme dengan pilihan mode app, bukan `system`.

## Acceptance Checklist

- [ ] Toggle dark/light mengubah seluruh shell utama.
- [ ] Tidak ada card putih mencolok yang tertinggal di dark mode kecuali memang disengaja.
- [ ] Tidak ada font abu gelap yang kehilangan kontras di dark mode.
- [ ] Dialog, sheet, dropdown, popover, dan toast mengikuti mode yang sedang aktif.
- [ ] Table header, row, border, empty state, dan action button konsisten di kedua mode.
- [ ] Halaman utama bisnis sudah lolos review visual:
  - dashboard
  - pesanan
  - prospek
  - laporan
  - iklan harian
  - pemantauan
  - schedule
  - user management
  - affiliate
  - teknisi mobile
- [ ] Tidak ada komponen legacy header/topbar yang memecah konsistensi tema.

## Catatan Audit

- Audit cepat menemukan banyak file dengan `bg-white` dan warna light-only.
- Audit cepat juga menemukan banyak file yang sudah memakai `dark:` variant, tetapi belum merata.
- Implementasi berikutnya sebaiknya dikerjakan bertahap:
  1. shell dan komponen global
  2. halaman high-traffic
  3. dialog, form, dan modul pendukung
