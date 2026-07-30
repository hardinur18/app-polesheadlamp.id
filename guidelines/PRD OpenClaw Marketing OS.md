# PRD OpenClaw Marketing OS

## 1. Ringkasan Produk

OpenClaw Marketing OS adalah fitur strategis dan workspace operasional di dalam web Restoration Headlamp Indonesia (RHI System) yang dirancang sebagai sistem operasi marketing dan conversion end-to-end.

Visi utamanya bukan hanya membaca performa iklan, tetapi mengotomatiskan seluruh alur dari traffic sampai menjadi uang:

- menarik data iklan melalui API
- membaca semua percakapan masuk melalui API
- menilai kualitas lead
- merespons dan melakukan follow-up otomatis
- membuat order
- menghitung jarak dan kesiapan operasional
- menganalisis foto customer di dalam alur chat untuk membantu identifikasi kondisi headlamp
- mengakses aset konten untuk iklan
- membuat dan mengatur iklan
- menjalankan aturan optimasi
- lalu memutar ulang seluruh siklus berdasarkan hasil closing nyata

Dengan kata lain, OpenClaw bukan sekadar dashboard. OpenClaw adalah `pusat kendali marketing + operator AI` untuk menjalankan bisnis secara objektif, cepat, dan semakin otonom.

## 1.1 Posisi Produk

OpenClaw bukan produk greenfield yang dibangun terpisah dari nol.

OpenClaw diposisikan sebagai:

- fitur strategis di dalam sistem yang sudah berjalan
- workspace khusus untuk observasi, insight, aksi, dan automasi
- calon sub-product yang tetap menempel pada auth, role, master data, lead, order, dan permission host system

Keputusan yang dikunci pada tahap ini:

- `Marketing OS` diperlakukan sebagai workspace khusus dengan boundary frontend yang mandiri
- workspace ini boleh memakai framework UI / frontend stack yang berbeda dari host app
- tetapi auth, permission, kontrak API, audit trail, dan source of truth tetap satu dengan RHI System

Artinya, asumsi dasar PRD ini adalah:

- aplikasi host sudah ada
- shell, auth, role, dan permission utama sudah ada
- entity bisnis utama seperti `user`, `lead`, `order`, `akun iklan`, dan `channel` sudah ada
- OpenClaw menambah lapisan orkestrasi, bukan mengganti fondasi inti sistem

## 1.2 Latar Belakang Masalah

Saat ini operasional marketing masih terlalu bergantung pada kerja manual:

- data iklan dibaca manual dari masing-masing platform
- analisis performa dilakukan manual
- laporan iklan dibuat manual
- data real lead dan closing harus ditanyakan ke CS
- kendala lapangan dan alasan tidak closing sering subjektif
- CS tidak bisa berjaga dan merespons 24/7
- kapasitas tim menerima lead tidak selalu terlihat jelas
- banyak keputusan penting masih berbasis feeling, bukan event dan angka yang konsisten

Masalah terbesar bukan hanya lambat, tetapi juga kurang objektif. Owner belum punya satu sumber kebenaran untuk menjawab:

- spend nyata berapa
- real lead masuk berapa
- closing berapa
- bottleneck ada di iklan, chat, kualitas lead, atau operasional
- kapasitas tim masih kuat atau sudah overload

## 1.3 Arah Utama Produk

Arah utama OpenClaw Marketing OS adalah:

`membangun mesin pendapatan otonom yang mampu mengelola seluruh perjalanan customer dari iklan, chat, analisis kebutuhan, follow-up, order, sampai optimasi ulang berdasarkan uang yang benar-benar masuk.`

## 1.4 Dokumen Turunan

Dokumen ini adalah PRD level produk. Detail implementasi dipisah ke dokumen turunan berikut:

- `Microfrontend Architecture OpenClaw Marketing OS.md`
- `Technical OpenClaw Marketing OS.md`
- `UI OpenClaw Marketing OS.md`

Catatan:

- keputusan boundary frontend modular, local design system, dan arsitektur 4-layer dirinci khusus di `Microfrontend Architecture OpenClaw Marketing OS.md`

## 2. Tujuan Produk

- Menjadikan marketing, percakapan, lead, order, dan closing sebagai satu sistem yang terhubung.
- Menghilangkan ketergantungan pada laporan manual yang rawan bias.
- Memberikan visibilitas penuh dari awal traffic sampai hasil uang masuk.
- Mempercepat keputusan budget dan operasional.
- Mengurangi kehilangan lead karena follow-up lambat atau tidak konsisten.
- Menyiapkan pondasi agar AI bisa membantu, lalu secara bertahap menjalankan operasi marketing secara semi-otonom hingga otonom.

## 3. Prinsip Produk

- API first. Semua data utama harus berasal dari integrasi resmi.
- Satu sumber kebenaran. Satu metrik harus punya definisi dan sumber yang jelas.
- Berbasis event. Sistem harus memahami event penting: spend, chat masuk, reply, lead qualified, order dibuat, closing, pembayaran.
- Realtime plus fallback. Data live dipakai saat tersedia, snapshot dipakai saat perlu.
- Dapat diaudit. Semua keputusan dan aksi penting harus bisa dijelaskan.
- Persetujuan manusia untuk aksi berisiko tinggi. Aksi sensitif tidak boleh otomatis penuh pada tahap awal.
- Otonomi bertahap. Robot tidak langsung full auto; ia naik tahap dari mengamati, membantu, mengeksekusi dengan persetujuan, lalu otomatisasi terkendali.

## 4. Persona Utama

- Owner / internet marketer specialist yang mengendalikan budget, strategi, dan evaluasi hasil.
- CS yang menangani percakapan, follow-up, dan konversi lead.
- Admin / PIC yang menjaga operasional dan kualitas data.
- Teknisi / operasional lapangan yang menerima order dan penugasan.
- Analyst internal yang mengevaluasi performa harian dan mingguan.

## 5. Pernyataan Masalah

OpenClaw harus menyelesaikan masalah berikut:

- Owner tidak bisa melihat jalur penuh dari `spend -> chat -> lead -> order -> uang`.
- Lead datang dari banyak channel, tetapi tindak lanjut tidak konsisten.
- Tidak ada pengukuran objektif soal siapa yang menjadi bottleneck.
- Tidak ada sistem yang tahu kapan tim sudah overload lead.
- Konten, ads, dan percakapan belum menjadi satu loop belajar.
- Proses order dan penjadwalan masih terlalu banyak sentuhan manual.

## 6. Cakupan Produk

### 6.1 Kecerdasan Iklan

OpenClaw harus bisa:

- menarik data Meta Ads, Google Ads, dan TikTok Ads melalui API
- menyimpan snapshot harian
- membaca spend, clicks, impressions, CTR, CPC, CPM, conversions, leads, orders, revenue bila tersedia
- menghubungkan akun internal dengan akun live
- menampilkan status data live, snapshot, partial, atau rate limited
- membandingkan performa antar periode
- memberi rekomendasi scale, cut, hold, atau investigate

### 6.2 Kecerdasan Percakapan

OpenClaw harus bisa:

- menarik percakapan dari Instagram DM, Messenger, WhatsApp, dan TikTok DM jika API tersedia
- memisahkan semua channel dengan jelas tetapi tetap bisa dibaca dari satu pusat inbox
- menghitung thread aktif, inbound message, unique contact, response time, dan status follow-up
- menandai percakapan panas, belum dibalas, tertunda, atau berpotensi closing
- menghubungkan percakapan dengan lead, order, dan hasil akhir

### 6.3 Agen Penjualan AI

OpenClaw harus bisa:

- membalas chat awal secara otomatis
- menggali kebutuhan customer
- meminta data kendaraan, lokasi, jadwal, dan foto
- melakukan follow-up otomatis bila customer belum merespons
- menjaga konteks percakapan lintas channel bila memungkinkan
- menaikkan percakapan ke manusia jika risiko tinggi atau intent user kompleks

### 6.4 Kemampuan Diagnostik Visual AI di Dalam Percakapan

OpenClaw harus bisa:

- menerima foto headlamp mobil dari customer di chat
- mengidentifikasi kondisi visual dasar dari foto
- memperkirakan kategori kerusakan atau treatment yang dibutuhkan
- memberi confidence level
- memberi sinyal jika foto belum cukup baik untuk dianalisis

Catatan:

- ini bukan modul layar yang berdiri sendiri
- ini adalah kemampuan AI yang menempel pada alur percakapan customer dan nantinya dapat membantu pembuatan lead atau order

### 6.5 Otomasi Order

OpenClaw harus bisa:

- membuat order dari hasil percakapan
- menghitung jarak antar lokasi
- menilai apakah area masih masuk jangkauan
- membantu estimasi waktu tempuh
- membantu memilih cabang atau teknisi yang paling masuk akal
- meneruskan hasil ke alur operasional di RHI System

### 6.6 Mesin Kreatif dan Konten

OpenClaw harus bisa:

- mengakses repository konten seperti Google Drive atau storage internal
- membaca struktur aset iklan
- memilih materi yang cocok untuk objective tertentu
- menyiapkan draft creative dan copy
- menyimpan hubungan antara aset, iklan, dan performa

### 6.7 Eksekusi Iklan dan Mesin Aturan

OpenClaw harus bisa:

- membuat draft campaign atau ad set
- membantu setting targeting, naming, budget, objective, dan aturan dasar
- mengatur aturan seperti stop-loss, scale-up, jam aktif, atau threshold CPL
- menjalankan optimasi ringan berdasarkan hasil nyata
- tetap memakai persetujuan untuk perubahan budget atau publish pada fase awal

## 7. Di Luar Cakupan MVP

- Full autonomous budget mutation tanpa persetujuan.
- Diagnosis visual yang dipakai sebagai keputusan final teknis tanpa validasi.
- Multi-touch attribution kompleks lintas semua touchpoint.
- CRM penuh pengganti semua alur sales sekaligus.
- Semua channel baru dipaksa masuk walau API dan stabilitas belum cukup.

## 8. User Story Inti

- Sebagai owner, saya ingin tahu hari ini spend berapa, chat masuk berapa, closing berapa, dan masalah utamanya ada di mana.
- Sebagai owner, saya ingin tahu akun mana yang harus dinaikkan dan mana yang harus dipotong.
- Sebagai owner, saya ingin tidak lagi bergantung pada jawaban subjektif CS untuk mengetahui real lead dan real closing.
- Sebagai CS, saya ingin tahu percakapan mana yang paling prioritas untuk dibalas.
- Sebagai CS, saya ingin dibantu membuat balasan dan follow-up yang konsisten.
- Sebagai operasional, saya ingin order yang masuk sudah membawa data lokasi, estimasi, dan konteks kerusakan.
- Sebagai owner, saya ingin robot secara bertahap bisa menangani seluruh siklus dari iklan sampai order.

## 9. Kebutuhan Fungsional

### 9.1 Lapisan Visibilitas

- Menampilkan dashboard lintas platform ads dan percakapan.
- Menampilkan filter tanggal yang cepat dan konsisten.
- Menampilkan mapping akun internal ke akun live.
- Menampilkan funnel dari spend ke uang.
- Menampilkan status data dan sumber data secara jujur.

### 9.2 Lapisan Insight

- Menampilkan deteksi anomali sederhana.
- Menampilkan perbandingan periode sekarang vs sebelumnya.
- Menampilkan indikator bottleneck: ads, response time, kualitas lead, atau closing.
- Menampilkan kapasitas tim berdasarkan volume lead dan response backlog.

### 9.3 Lapisan Aksi

- Membuat draft reply.
- Membuat draft follow-up.
- Membuat draft order.
- Membuat draft iklan.
- Menjalankan aturan iklan dasar.
- Menyimpan log persetujuan untuk aksi sensitif.

### 9.4 Lapisan Otomasi

- Follow-up otomatis untuk lead yang belum merespons.
- Routing otomatis ke manusia jika confidence rendah atau masalah kompleks.
- Pembuatan order otomatis bila syarat tertentu terpenuhi.
- Eksekusi aturan iklan otomatis untuk aturan berisiko rendah.

## 10. Kebutuhan Data

- Semua data ads harus tersimpan sebagai snapshot harian.
- Semua percakapan harus punya timestamp, channel, source, contact identifier, dan linkage ke lead atau order bila ada.
- Semua order yang dibuat oleh robot harus punya jejak asal.
- Semua rekomendasi dan aksi AI harus punya reason log.
- Semua metrik harus punya definisi UI dan backend yang sama.
- Semua fallback harus bisa menjelaskan apakah data datang dari live API, snapshot DB, atau webhook store.

## 11. KPI Produk

- Waktu membaca kondisi marketing harian turun drastis.
- Ketergantungan pada laporan manual CS turun drastis.
- Response time pertama percakapan turun.
- Lead loss karena slow response turun.
- Waktu untuk mengambil keputusan budget turun menjadi hitungan menit, bukan jam.
- Persentase order yang bisa ditelusuri sampai source ads dan percakapan meningkat.
- Persentase operasi yang dapat dibantu AI meningkat.

## 12. Risiko Produk

- API rate limit menyebabkan live data tidak lengkap.
- Histori webhook belum penuh sehingga metrik harian percakapan bisa misleading.
- AI bisa mengambil aksi salah jika definisi data tidak rapi.
- Otomasi terlalu cepat bisa merusak trust jika persetujuan belum matang.
- Diagnosis visual dari foto bisa salah jika kualitas input buruk.

## 13. Strategi Mitigasi

- Selalu sediakan snapshot DB dan status fallback.
- Semua status data harus transparan di UI.
- Semua aksi berisiko tinggi harus berbasis persetujuan.
- Diagnosis AI harus punya confidence dan jalur eskalasi.
- Definisi metrik harus dijaga ketat di dokumentasi teknis.

## 14. Fase Implementasi

### Fase 1 - Mengamati

- Semua data ads dan percakapan terhubung.
- Semua funnel dasar terlihat.
- Snapshot dan fallback stabil.

### Fase 2 - Membantu

- AI memberi ringkasan, rekomendasi, dan draft.
- Sistem mulai membantu CS dan owner mengambil keputusan.

### Fase 3 - Eksekusi Dengan Persetujuan

- Robot bisa membuat draft order, draft iklan, dan draft balasan.
- Robot bisa menjalankan aksi setelah disetujui.

### Fase 4 - Otonomi Terkendali

- Aksi berisiko rendah berjalan otomatis.
- Manusia tetap mengawasi aksi berisiko tinggi.

### Fase 5 - Siklus Pendapatan Penuh

- OpenClaw mampu menjalankan sebagian besar siklus dari traffic sampai uang dengan campur tangan manusia yang jauh lebih kecil.

## 15. Definisi Sukses Produk

OpenClaw Marketing OS dianggap berhasil jika:

- owner tidak lagi perlu bertanya manual untuk tahu performa iklan, real lead, dan real closing
- seluruh perjalanan customer dari ads sampai order bisa dilacak jelas
- sistem dapat menunjukkan kendala utama secara objektif
- follow-up tidak lagi bergantung penuh pada manusia
- keputusan budget dan operasional menjadi lebih cepat, lebih transparan, dan lebih konsisten

## 16. Catatan Arah Produk

OpenClaw Marketing OS adalah pondasi menuju `full robot from traffic to money`.

Itu berarti sistem ini pada akhirnya harus mampu:

- melihat
- memahami
- memutuskan
- mengeksekusi
- dan belajar ulang dari hasil uang yang benar-benar masuk

Ads Monitoring hanyalah salah satu modul di dalam visi ini. Target akhirnya jauh lebih besar: menjadikan marketing, conversation, dan conversion engine Restoration Headlamp Indonesia berjalan semakin otomatis, semakin objektif, dan semakin terukur.
