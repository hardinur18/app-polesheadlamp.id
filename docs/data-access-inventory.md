# Data Access Inventory

Terakhir update: 2026-10-07

Dokumen ini memetakan cara frontend RHI System membaca/menulis data hari ini, lalu menetapkan aturan target agar struktur siap dirapikan sebelum migrasi VPS.

## Ringkasan Audit

- Ditemukan sekitar 323 match akses Supabase langsung di `src/app`.
- Ditemukan sekitar 89 penggunaan `buildMakeServerUrl` di `src/app`.
- Ditemukan sekitar 144 route handler Edge Function di `supabase/functions/server`.
- Kondisi saat ini bukan "rusak total", tapi pola aksesnya campur: sebagian sudah lewat API, sebagian masih direct Supabase dari page/component.
- Risiko terbesar bukan pada satu fitur saja, tapi pada side effect bisnis yang tersebar: login/profile, prospek, order, jadwal, finance, stock, proof asset, dan dashboard snapshot.

## Aturan Target

### Wajib Lewat Server/API

Flow ini harus distandarkan lewat service client -> API -> database:

- User, role, permission, profile admin.
- Prospek, booking prospek, dan perubahan status/lifecycle prospek.
- Pesanan, jadwal, assignment teknisi, dan conflict checking.
- Payment, laporan operasional, kas, hutang/piutang, payroll, dan finance ledger.
- Stock product, stock transaction, stock unit, dan stock valuation.
- Upload/delete file penting: bukti bayar, dokumentasi pekerjaan, avatar, logo, dan asset operasional.
- Sync API eksternal: Meta, Google, TikTok, WhatsApp, dan snapshot dashboard.
- Semua operasi yang butuh service role, validasi lintas tabel, audit log, atau side effect bisnis.

### Boleh Direct Supabase Sementara

Direct Supabase masih boleh untuk area ini, asal tetap terukur:

- `supabase.auth` client session: sign in, sign out, get session, refresh session, auth state listener.
- Read-only table kecil untuk pilihan UI, kalau query punya limit/order jelas dan tidak berisi data sensitif.
- Read-only fallback dashboard yang sudah range-scoped dan indexed.
- Public URL read dari storage, selama upload/delete tetap dikontrol.
- Query audit/read-only sementara, selama bukan full history tanpa limit.

### Tidak Boleh

Pola ini harus dihapus bertahap:

- Component/page menulis langsung ke tabel kritis.
- Query full history otomatis saat mount.
- Business rule lintas tabel berada di UI.
- Upload file sensitif langsung dari page tanpa validasi server.
- Fallback API yang diam-diam fetch data besar saat database lambat.
- Error database mentah langsung dilempar ke user.

## Inventory Area

| Area | Kondisi Sekarang | Target |
| --- | --- | --- |
| Auth/session | `supabase.auth` dipakai langsung di `LoginPage`, `AuthenticatedApp`, dan helper session. Ini wajar untuk auth client, tapi profile/role masih punya beberapa fallback. | Auth client tetap direct; profile/role dibaca lewat endpoint kecil/cache yang jelas timeout-nya. |
| Permission | Sudah ada route `permissions` dan hook `usePermissions`. | Tetap lewat API, dengan response shape konsisten dan cache singkat. |
| Master data | Campuran `MasterDataCtx`, `masterDataService`, `/master/:type`, dan `/app-data/:type`. | Semua CRUD master lewat service typed; context hanya state orchestration. |
| Dashboard API/snapshot | Ada Edge route Meta/Google/TikTok dan fallback DB snapshot. UI mulai membaca snapshot, tombol sync menjalankan API. | UI selalu render dari database snapshot terakhir; external API hanya untuk sync manual/scheduled. |
| Prospek | Endpoint `/leads` ada, tapi page/context masih besar dan beberapa side effect hidup di UI/service. | Prospek create/update/forward lewat API service yang validasi duplicate dan lifecycle di server. |
| Pesanan/jadwal | Endpoint `/orders` ada, `orderScheduleValidation` dan page masih melakukan direct read lintas tabel. | Create/update/status order lewat order service server; UI hanya kirim intent dan render hasil. |
| Finance/payment | Ada endpoint operational expenses/payroll, tapi `Kas`, `Laporan`, `DebtsPage`, dan beberapa tab master masih direct write/read. | Semua write finance lewat API ledger; read harus date-scoped dan indexed. |
| Stock | Endpoint stock ada, tapi `ProductList`, `StockTransactions`, `StockSettings`, dan report masih direct table access. | Semua stock CRUD lewat endpoint stock agar stock movement atomic. |
| Proof assets | `proofAssets` sudah pakai `/app-data` dan storage. Masih ada storage direct remove/public URL. | Upload/delete lewat API; public URL read boleh tetap helper. |
| WhatsApp/live chat | Banyak endpoint Edge sudah tersedia, masih ada direct read page tertentu. | Conversation/contact read-write lewat API/module service. |
| Audit log | `auditService` masih direct insert/read. | Insert audit lewat helper server untuk flow kritis; read dashboard boleh via endpoint scoped. |
| Reports/monitoring | Banyak komputasi dilakukan dari data context dan beberapa direct query. | Reports memakai endpoint agregasi/date range agar UI tidak menarik dataset besar. |

## File Hotspot

Direct Supabase terbanyak saat audit:

- `src/app/pages/Pesanan.tsx`
- `src/app/pages/stock/components/StockTransactions.tsx`
- `src/app/pages/advertiser/AdvertiserDashboard.tsx`
- `src/app/pages/Laporan.tsx`
- `src/app/pages/Kas.tsx`
- `src/app/pages/stock/components/ProductList.tsx`
- `src/app/pages/finance/DebtsPage.tsx`
- `src/app/pages/master-data/tabs/OperationalExpenseCategoriesTab.tsx`
- `src/app/pages/ads/UnifiedAdsMonitoringPage.tsx`
- `src/app/pages/master-data/context/MasterDataCtx.tsx`

API/Edge terbanyak dipakai dari:

- `src/app/pages/master-data/context/MasterDataCtx.tsx`
- `src/app/pages/finance/PayrollPage.tsx`
- `src/app/hooks/usePermissions.tsx`
- `src/app/pages/TeknisiMobile.tsx`
- `src/app/services/proofAssets.ts`
- `src/app/services/embedLeadForms.ts`
- `src/app/pages/MonitoringPage.tsx`

## Urutan Refactor Aman

1. Buat wrapper API client standar: timeout, session headers, JSON parsing, error message, dan abort controller.
2. Buat repository/service per domain tanpa mengubah UI dulu.
3. Pindahkan write kritis satu per satu: stock, finance/payment, prospek, pesanan.
4. Pindahkan read berat menjadi endpoint date-scoped/agregasi.
5. Simpan auth client sebagai pengecualian resmi.
6. Setelah setiap domain selesai, jalankan typecheck, lint, build, dan smoke yang relevan.

## Prinsip Eksekusi

- Jangan refactor banyak domain dalam satu commit.
- Jangan ubah flow bisnis sambil memindahkan transport data.
- Satu PR/commit idealnya hanya satu domain.
- Fitur yang sedang dikerjakan agent lain jangan disentuh sampai stabil.
- Target akhirnya bukan "semua direct Supabase hilang", tapi semua akses data punya alasan, batas, dan pemilik yang jelas.
