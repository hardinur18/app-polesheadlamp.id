# UI OpenClaw Marketing OS

## 1. Tujuan Dokumen

Dokumen ini menjelaskan rancangan UI untuk OpenClaw Marketing OS di dalam RHI System.

Fokus dokumen ini:

- struktur layar
- blok interface per fitur
- field yang harus terlihat di UI
- state yang harus dijelaskan ke user
- perilaku interaksi utama
- kemungkinan OpenClaw dibuat sebagai modul yang berdiri sendiri

Dokumen ini bukan dokumen teknis backend. Dokumen ini fokus pada bagaimana user membaca, memahami, dan menjalankan aksi dari data yang tersedia.

Dokumen ini harus dibaca bersama:

- `Blueprint OpenClaw Marketing OS.md`
- `Microfrontend Architecture OpenClaw Marketing OS.md`
- `Technical OpenClaw Marketing OS.md`

## 1.1 Posisi UI di Host System

UI OpenClaw default-nya bukan aplikasi visual yang terpisah dari nol.

UI OpenClaw diposisikan sebagai:

- fitur / workspace di dalam web RHI System yang sudah berjalan
- area operasional dengan bahasa visual yang bisa lebih tegas dan mandiri
- lapisan baru di atas shell, login, role, dan navigasi utama yang sudah ada

Artinya, baseline desainnya adalah:

- tetap menempel ke auth dan permission host system
- tetap membaca source of truth yang sama
- tetap menghormati struktur entity yang sudah ada
- baru dipisah menjadi frontend/workspace mandiri jika kebutuhan scale, kebebasan UI, atau kecepatan iterasi memang menuntut

## 1.2 Global Design Rules Khusus Marketing OS

Marketing OS boleh punya `global visual rules` sendiri, tetapi hanya di dalam workspace itu.

Artinya:

- boleh punya font heading sendiri
- boleh punya radius kartu sendiri
- boleh punya padding shell sendiri
- boleh punya token table density sendiri
- boleh punya card style dan drawer style sendiri
- tetapi semua itu harus di-scope ke shell Marketing OS, bukan ke seluruh app

Rekomendasi awal:

- `shell padding x`: `24px`
- `shell padding y`: `24px`
- `section gap`: `24px`
- `card gap`: `16px`
- `card radius`: `24px`
- `control/button/input radius`: `20px`
- `drawer radius`: `30px`
- `card padding`: `20px`
- `input height`: `48px`
- `button default height`: `44px`
- `table header height`: `40px`
- `table row height`: `46px`
- `font heading`: `Public Sans`
- `font body`: `Inter`
- `font mono`: `IBM Plex Mono`

Prinsip visual:

- terasa seperti control room modern
- dense, tajam, dan cepat discan
- lebih premium dari host system, tapi tidak terasa seperti brand lain
- status data dan alert harus langsung terlihat

Kontrak implementasi:

- token ini diperlakukan sebagai `local design system` khusus `Marketing OS`
- seluruh modul di dalam `Marketing OS` wajib membaca token yang sama
- padding, radius, drawer, table density, badge, dan tipografi tidak boleh liar per modul
- boundary, namespace, dan kontrak modular FE dirinci di `Microfrontend Architecture OpenClaw Marketing OS.md`

## 2. Prinsip UI

- Harus terasa seperti pusat kendali operasional, bukan landing page marketing.
- User harus bisa tahu kondisi bisnis dalam hitungan detik.
- Angka penting harus bisa dibaca tanpa membuka banyak layer.
- Sumber data harus jujur: live, snapshot, fallback, partial, atau rate limit.
- UI harus mengurangi ambiguitas, bukan menambah interpretasi.
- Aksi AI harus terasa membantu, bukan mengambil alih tanpa konteks.
- Jika data belum valid penuh, UI harus bilang terus terang.

## 3. Keputusan Arsitektur UI

## 3.1 Apakah bisa berdiri sendiri?

Bisa.

Dan untuk tahap ini, keputusan yang dikunci adalah:

- `Marketing OS` diperlakukan sebagai workspace khusus dengan boundary frontend yang mandiri
- workspace ini tetap hidup di dalam RHI System dari sisi produk dan navigasi
- tetapi dari sisi UI/frontend, ia boleh memakai framework atau stack yang berbeda
- shell visual, design system, dan pola interaksinya boleh dibuat lebih mandiri

OpenClaw Marketing OS bisa:

- tetap hidup di dalam RHI System
- tetapi punya workspace sendiri
- atau bahkan punya frontend sendiri
- atau punya framework UI sendiri

selama hal berikut tetap sama:

- auth
- permission
- source of truth data
- kontrak API
- identitas entity seperti user, lead, order, akun iklan, dan channel

Untuk arsitektur final, pembacaan UI-nya harus mengikuti `4 layer`:

1. `Host Shell`
2. `Marketing OS Frontend`
3. `Shared Backend / Orchestration`
4. `Data + Integration`

Rincian boundary FE, mount point, package modular, dan token global ada di `Microfrontend Architecture OpenClaw Marketing OS.md`.

## 3.2 Rekomendasi

Untuk fase sekarang, rekomendasi UI paling aman adalah:

- tetap satu sistem login
- tetap satu backend
- tetap satu permission model
- OpenClaw diberi workspace visual yang lebih mandiri di dalam sistem host
- boundary frontend Marketing OS dipersiapkan sejak awal agar nanti mudah dipisah atau ditumbuhkan tanpa bongkar host system

Jadi secara pengalaman user, tetap terasa satu sistem. Tetapi secara desain dan arsitektur frontend, OpenClaw boleh diperlakukan seperti sub-product.

## 4. Struktur Navigasi OpenClaw

OpenClaw sebaiknya dibagi menjadi area berikut:

1. `Command Center`
2. `Ads Monitoring`
3. `Conversation Hub`
4. `Lead Intelligence`
5. `Order Automation`
6. `Creative & Content Center`
7. `AI Action Center`

Kalau ingin dibuat lebih ramping pada fase awal:

1. `Command Center`
2. `Ads Monitoring`
3. `Conversation Hub`
4. `AI Action Center`

## 4.1 Usulan Tree Sidebar di Sistem Host

Sidebar asli yang sekarang di code dibagi menjadi:

- `Dashboard`
- `OPERASIONAL`
- `KEUANGAN`
- `ADMINISTRASI`
- footer akun user / logout

### Tree sidebar real saat ini

```text
DASHBOARD
└── Dashboard
    ├── Owner View
    ├── Advertiser View
    ├── CS View
    └── Teknisi View

OPERASIONAL
├── Iklan Harian
├── Monitoring Perf.
├── Ads Monitoring
│   ├── workspace Ads Monitoring (sesuai config aktif)
│   └── child workspace lain (sesuai config aktif)
├── Conversation Center
│   ├── workspace Conversation Center (sesuai config aktif)
│   └── child workspace lain (sesuai config aktif)
├── Affiliate
├── Prospek
├── Pesanan & Penugasan
├── Laporan Operasional
├── Jadwal
├── Ketersediaan Teknisi
├── Jadwal Saya
├── Aktivitas Teknisi
├── Pemantauan Lapangan
└── Peta Sebaran

KEUANGAN
├── Payroll & Gaji
├── Pembayaran
├── Pengeluaran Rutin
├── Kas Masuk/Keluar
├── Hutang & Piutang
├── Operasional Teknisi
└── Payment Gateway

ADMINISTRASI
├── Inventaris
│   ├── Master Data Produk
│   ├── Transaksi & Mutasi
│   ├── Laporan Valuasi
│   └── Pengaturan Stok
├── Master Data
├── Pengguna & Akses
├── Role Permission
└── Template WhatsApp

FOOTER
└── Profil user + logout
```

Kalau `Conversation Center` lama dihapus, arah sidebar yang lebih rapi adalah menjadikan OpenClaw sebagai satu parent item baru di grup `OPERASIONAL`, sementara `Monitoring Perf.` tetap dipertahankan di atas `Marketing OS`.

### Usulan tree sidebar utama di level sistem penuh

```text
DASHBOARD
└── Dashboard
    ├── Owner View
    ├── Advertiser View
    ├── CS View
    └── Teknisi View

OPERASIONAL
├── Iklan Harian
├── Monitoring Perf.
├── Marketing OS
│   ├── Command Center
│   ├── Ads Monitoring
│   ├── Conversation Hub
│   ├── Lead Intelligence
│   ├── Order Automation
│   ├── Creative & Content Center
│   └── AI Action Center
├── Affiliate
├── Prospek
├── Pesanan & Penugasan
├── Laporan Operasional
├── Jadwal
├── Ketersediaan Teknisi
├── Jadwal Saya
├── Aktivitas Teknisi
├── Pemantauan Lapangan
└── Peta Sebaran

KEUANGAN
├── Payroll & Gaji
├── Pembayaran
├── Pengeluaran Rutin
├── Kas Masuk/Keluar
├── Hutang & Piutang
├── Operasional Teknisi
└── Payment Gateway

ADMINISTRASI
├── Inventaris
│   ├── Master Data Produk
│   ├── Transaksi & Mutasi
│   ├── Laporan Valuasi
│   └── Pengaturan Stok
├── Master Data
├── Pengguna & Akses
├── Role Permission
└── Template WhatsApp

FOOTER
└── Profil user + logout
```

### Rekomendasi implementasi fase awal

Kalau ingin lebih aman dan tidak terlalu berat di sidebar, fase awal bisa begini:

```text
DASHBOARD
└── Dashboard

OPERASIONAL
├── Iklan Harian
├── Monitoring Perf.
├── Marketing OS
│   ├── Command Center
│   ├── Ads Monitoring
│   ├── Conversation Hub
│   └── AI Action Center
├── Affiliate
├── Prospek
├── Pesanan & Penugasan
├── Laporan Operasional
├── Jadwal
├── Ketersediaan Teknisi
├── Jadwal Saya
├── Aktivitas Teknisi
├── Pemantauan Lapangan
└── Peta Sebaran

KEUANGAN
├── Payroll & Gaji
├── Pembayaran
├── Pengeluaran Rutin
├── Kas Masuk/Keluar
├── Hutang & Piutang
├── Operasional Teknisi
└── Payment Gateway

ADMINISTRASI
├── Inventaris
├── Master Data
├── Pengguna & Akses
├── Role Permission
└── Template WhatsApp
```

### Catatan keputusan navigasi

- `Monitoring Perf.` tetap dipertahankan sebagai modul host yang berdiri sendiri di atas `Marketing OS`
- `Conversation Center` lama sebaiknya digantikan oleh `Marketing OS > Conversation Hub`
- `Prospek` dan `Pesanan & Penugasan` tetap dipertahankan sebagai modul host system
- `Lead Intelligence` dan `Order Automation` di OpenClaw sebaiknya diposisikan sebagai workspace analitis dan orkestrasi, bukan pengganti total modul `Prospek` dan `Pesanan`
- kemampuan AI visual dari foto customer tidak perlu jadi item sidebar, karena itu adalah capability di dalam `Conversation Hub`
- sidebar sebaiknya berhenti di 2 level: `OPERASIONAL -> Marketing OS -> Workspace`
- struktur yang lebih dalam sebaiknya memakai `tab`, `subnav horizontal`, `segmented control`, atau `context drawer`, bukan sidebar level ketiga

### Rekomendasi label parent

Pilihan label parent terbaik:

- `Marketing OS`
- `OpenClaw OS`
- `OpenClaw Marketing OS`

Untuk sidebar nyata, yang paling ringkas dan enak dibaca:

- `Marketing OS`

Karena:

- pendek
- mudah dipahami
- tetap premium
- tidak terlalu panjang di sidebar kiri

## 5. Pola Layout Utama

Semua halaman OpenClaw sebaiknya mengikuti pola yang konsisten:

### 5.1 Top Control Bar

Isi minimum:

- filter tanggal
- filter platform
- filter advertiser
- filter channel
- compare mode
- status sinkronisasi
- tombol refresh
- tombol aksi AI jika relevan

### 5.2 Summary Strip

Baris kartu ringkasan cepat, biasanya 4-8 kartu.

Contoh isi:

- spend
- lead
- order
- revenue
- CPL
- response time
- unread backlog
- alert count

### 5.3 Main Workspace

Area inti layar, biasanya salah satu dari:

- tabel utama
- daftar percakapan
- matriks performa
- timeline aktivitas
- queue aksi AI

### 5.4 Context Drawer / Side Panel

Panel kanan atau drawer detail untuk item yang dipilih.

Panel ini dipakai untuk:

- detail akun
- detail percakapan
- detail lead
- detail order
- detail rekomendasi AI

## 6. Layar 1: Command Center

## 6.1 Tujuan

Memberi jawaban tercepat untuk owner:

- hari ini uang keluar berapa
- lead masuk berapa
- order jadi berapa
- masalah utamanya ada di mana
- channel mana yang paling perlu perhatian

## 6.2 Komposisi UI

### Baris 1: Status Integrasi

Widget:

- Meta Ads
- Google Ads
- TikTok Ads
- Instagram DM
- Messenger
- WhatsApp
- TikTok DM

Field yang perlu tampil:

- `status`
- `last_synced_at`
- `source`
- `warning_message`

### Baris 2: Kartu KPI Utama

Kartu minimum:

- `Spend Hari Ini`
- `Lead Hari Ini`
- `Order Hari Ini`
- `Pendapatan Hari Ini`
- `CPL`
- `Response Time`
- `Unread Percakapan`
- `Alert Prioritas`

### Baris 3: Funnel Ringkas

Urutan:

- impressions
- clicks
- conversations
- leads
- orders
- paid / revenue

### Baris 4: Alert dan Insight

Blok:

- `Anomali Iklan`
- `Percakapan Panas Belum Dibalas`
- `Akun Boros`
- `CS Overload`
- `Lead Macet`

## 6.3 Field yang harus tersedia di UI

- `total_spend`
- `total_clicks`
- `total_impressions`
- `total_conversations`
- `total_leads`
- `total_orders`
- `total_revenue`
- `cpl`
- `response_time_first_reply`
- `backlog_unread_count`
- `alert_count`
- `integration_status[]`

## 7. Layar 2: Ads (Ads Monitoring)

## 7.1 Tujuan

Membaca performa akun iklan secara objektif dan cepat, lalu memberi arah aksi.

## 7.2 Komposisi UI

### Header Summary

Kartu:

- spend
- lead
- order
- revenue
- CPL
- CTR
- burn
- GM estimasi jika tersedia

### Tabel Utama Akun Iklan

Kolom yang disarankan:

- `platform`
- `akun internal`
- `akun live`
- `group / BM / manager`
- `spend`
- `lead`
- `order`
- `revenue`
- `CPL`
- `CTR`
- `status data`
- `aksi`

### Filter yang wajib

- tanggal
- platform
- advertiser
- akun aktif saja
- tampilkan unmapped
- tampilkan akun bermasalah saja

### Drawer Detail Akun

Tab di dalam drawer:

- `Ringkasan`
- `Metrik`
- `Riwayat Sinkron`
- `Masalah Data`
- `Rekomendasi AI`

## 7.3 Field yang harus tampil

- `platform`
- `internal_ad_account_name`
- `live_account_name`
- `group_name`
- `spend`
- `clicks`
- `impressions`
- `reach`
- `conversions`
- `leads`
- `orders`
- `revenue`
- `ctr`
- `cpc`
- `cpm`
- `cost_per_conversion`
- `cpl`
- `source`
- `snapshot_date`
- `synced_at`
- `error`
- `rate_limited`

## 7.4 State penting

- live
- snapshot database
- fallback terakhir
- rate limit
- akun belum dipetakan
- akun aktif tapi belum ada snapshot
- akun error

## 8. Layar 3: Conversation Hub

## 8.1 Tujuan

Membaca semua chat masuk, menilai prioritas, dan mengubah percakapan menjadi lead atau order.

## 8.2 Komposisi UI

### Header Summary

Kartu:

- thread aktif hari ini
- inbound message hari ini
- unique contact hari ini
- belum dibalas
- median response time
- high-priority conversation

### Panel Kiri: Daftar Percakapan

Harus bisa:

- dikelompokkan per channel
- difilter tanggal
- difilter status
- dicari nama / handle / nomor
- menunjukkan last activity
- menunjukkan unread
- menunjukkan priority

### Panel Tengah: Detail Percakapan

Harus menampilkan:

- identitas kontak
- channel
- timeline pesan
- source
- status follow-up
- quick reply
- draft AI reply
- hasil analisis foto customer bila ada

### Panel Kanan: Context Panel

Harus menampilkan:

- lead terkait
- order terkait
- advertiser / source ads
- CS owner
- status qualification
- rekomendasi next action
- kartu `AI visual diagnosis` jika customer mengirim foto

## 8.3 Field yang harus tampil

### Header / daftar

- `platform`
- `contact_name`
- `contact_handle`
- `last_message_at`
- `last_message_text`
- `unread_count`
- `message_count`
- `source`
- `channel_label`

### Detail percakapan

- `conversation_id`
- `channel_id`
- `direction`
- `sender_name`
- `text`
- `attachments`
- `photo_diagnosis.detected_condition`
- `photo_diagnosis.severity`
- `photo_diagnosis.recommended_action`
- `photo_diagnosis.confidence`
- `timestamp`
- `graph_link`

### Statistik harian

- `date`
- `inbound_messages`
- `new_conversations`
- `unique_contacts`
- `instagram_inbound_messages`
- `messenger_inbound_messages`

## 8.4 State penting

- live API
- webhook store
- fallback thread activity
- DM belum aktif
- channel belum subscribe
- thread kosong
- send message disabled

## 9. Layar 4: Lead Intelligence

## 9.1 Tujuan

Melihat kualitas lead setelah masuk dari ads dan percakapan.

## 9.2 Komposisi UI

### Tabel Lead

Kolom:

- `nama`
- `nomor`
- `source platform`
- `sub-channel`
- `conversation source`
- `status lead`
- `status qualification`
- `assigned CS`
- `last follow-up`
- `order status`

### Sidebar Insight

Blok:

- lead baru
- lead panas
- lead duplikat
- lead belum ditindak
- lead jadi order

## 9.3 Field yang harus tersedia

- `lead_id`
- `customer_name`
- `customer_phone`
- `platform_id`
- `sub_channel_id`
- `conversation_id`
- `assigned_cs_id`
- `lead_status`
- `qualified_status`
- `follow_up_status`
- `last_follow_up_at`
- `order_id`
- `created_at`

## 10. Layar 5: Order Automation

## 10.1 Tujuan

Mengubah hasil chat menjadi order yang siap dijalankan.

## 10.2 Komposisi UI

### Form Order Otomatis / Semi Otomatis

Field utama:

- customer
- kendaraan
- layanan
- alamat
- maps
- tanggal
- jam
- cabang
- teknisi
- estimasi jarak
- estimasi waktu

### Panel Rekomendasi Operasional

Blok:

- cabang terdekat
- teknisi yang tersedia
- kapasitas teknisi
- jarak
- warning area di luar jangkauan

### Tabel Queue Order

Kolom:

- `customer`
- `jadwal`
- `branch`
- `technician`
- `distance`
- `status`
- `source`

## 10.3 Field yang harus tampil

- `customer_name`
- `customer_phone`
- `address`
- `maps_url`
- `lat`
- `lng`
- `service_date`
- `service_time`
- `branch_id`
- `technician_id`
- `vehicle_id`
- `service_id`
- `distance_km`
- `estimated_duration`
- `status`

## 11. Kemampuan AI Visual di Dalam Percakapan

## 11.1 Tujuan

Membaca kondisi headlamp dari foto customer sebagai bahan bantu balas chat, qualification, dan keputusan lanjutan.

Catatan:

- ini bukan layar terpisah
- ini adalah kemampuan AI yang muncul di detail percakapan atau context panel

## 11.2 Komposisi UI

### Blok di Detail Percakapan / Context Panel

- preview foto customer
- hasil klasifikasi visual
- confidence
- rekomendasi tanggapan
- butuh review manusia atau tidak

### Aksi yang mungkin tersedia

- gunakan hasil ke draft reply
- tandai perlu inspeksi manual
- teruskan ke lead / order
- abaikan hasil AI

## 11.3 Field yang harus tampil

- `image_url`
- `detected_condition`
- `severity`
- `recommended_action`
- `confidence`
- `needs_human_review`
- `created_at`
- `used_in_reply`

## 11.4 State penting

- belum ada foto
- foto sedang diproses
- hasil draft
- butuh review
- hasil final

## 12. Layar 6: Creative & Content Center

## 12.1 Tujuan

Menghubungkan aset konten dengan iklan dan performa.

## 12.2 Komposisi UI

### Library Konten

Tampilan grid atau table:

- thumbnail
- nama aset
- jenis aset
- hook
- platform fit
- status

### Detail Asset

- preview
- metadata
- file origin
- relasi ke campaign
- performa asset

## 12.3 Field yang harus tersedia

- `asset_id`
- `asset_name`
- `asset_type`
- `storage_provider`
- `storage_path`
- `drive_file_id`
- `thumbnail_url`
- `caption`
- `copy_angle`
- `hook_type`
- `platform_fit`
- `status`
- `linked_campaign_ids`
- `performance_summary`

## 13. Layar 7: AI Action Center

## 13.1 Tujuan

Menjadi pusat rekomendasi dan persetujuan aksi AI.

## 13.2 Komposisi UI

### Queue Rekomendasi

Kolom:

- prioritas
- jenis aksi
- entitas terkait
- ringkasan alasan
- status persetujuan
- waktu dibuat

### Detail Aksi

- alasan
- bukti
- payload yang diusulkan
- risiko
- dampak
- tombol setujui / tolak / edit

## 13.3 Field yang harus tersedia

- `action_id`
- `action_type`
- `priority`
- `title`
- `reason`
- `evidence`
- `related_entity_type`
- `related_entity_id`
- `proposed_payload`
- `approval_status`
- `approved_by`
- `approved_at`
- `executed_at`
- `execution_result`

## 14. Komponen Bersama

OpenClaw sebaiknya punya komponen bersama berikut:

- `GlobalControlBar`
- `DateRangeFilter`
- `PlatformFilter`
- `StatusBadge`
- `SyncStatusPill`
- `AlertCard`
- `MetricCard`
- `InsightCard`
- `RecommendationCard`
- `ContextDrawer`
- `AuditTimeline`
- `ApprovalPanel`
- `SourceBadge`

## 15. State UI yang Wajib Konsisten

Setiap layar harus konsisten menjelaskan state berikut:

- `loading`
- `live`
- `snapshot`
- `fallback`
- `partial`
- `rate limit`
- `error`
- `empty`
- `unmapped`
- `approval required`

## 16. Hak Akses UI

Hak akses minimum yang perlu dipikirkan:

- `owner`: full visibility + approval
- `advertiser`: ads-focused view
- `cs`: conversation + lead view
- `pic/admin`: order + operational view
- `analyst`: read-only insight view

UI harus mampu menyembunyikan:

- aksi sensitif
- data sensitif
- approval panel
- mutation control

berdasarkan role.

## 17. Responsive Strategy

### Desktop

Mode utama untuk OpenClaw.

Alasan:

- data padat
- banyak filter
- banyak table
- banyak drawer

### Tablet

Harus tetap usable untuk:

- membaca dashboard
- buka detail
- approval aksi

### Mobile

Tidak harus full parity pada fase awal.

Prioritas mobile:

- lihat alert
- lihat summary
- lihat inbox prioritas
- approve / reject action penting

## 18. Rekomendasi Praktis untuk UI

Untuk fase awal:

- bangun `Command Center`, `Ads Monitoring`, `Conversation Hub`, dan `AI Action Center` dulu
- gunakan satu bahasa visual yang operasional dan padat
- pertahankan drawer detail sebagai pola utama
- semua angka penting harus punya status sumber data

Untuk fase menengah:

- tambah `Lead Intelligence`
- tambah `Order Automation`
- tambah `Creative & Content Center`
- tambah `kemampuan AI visual di dalam percakapan`

## 19. Kesimpulan

UI OpenClaw Marketing OS harus dirancang sebagai workspace operasional yang mampu:

- membuat owner cepat melihat kondisi bisnis
- membuat CS cepat menindak percakapan
- membuat tim cepat memahami bottleneck
- dan pada akhirnya menjadi tempat persetujuan dan kendali untuk robot OpenClaw

UI ini boleh berdiri sendiri, boleh punya gaya visual sendiri, dan bahkan boleh memakai framework frontend berbeda.

Namun selama:

- auth tetap satu
- permission tetap satu
- source of truth tetap satu
- dan kontrak API tetap satu

maka OpenClaw tetap bisa tumbuh sebagai modul mandiri tanpa memecah sistem bisnisnya.
