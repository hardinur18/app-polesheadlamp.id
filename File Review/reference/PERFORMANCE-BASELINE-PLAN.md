# Performance Baseline Plan for Mobile Chrome

Status: Reference plan plus latest emulated baseline
Date: 2026-04-20
Scope: Measurement method plus latest baseline reference, no optimization yet
Document role: Supporting reference for performance baseline work

## Purpose

Dokumen ini disusun untuk menyiapkan baseline performa sebelum task optimasi atau refactor yang mengklaim akan membantu masalah lemot di Chrome HP.

Dokumen ini sekarang berisi:

- apa yang perlu diukur
- halaman apa yang harus diuji
- hipotesis bottleneck awal
- evidence apa yang harus dikumpulkan
- pointer ke hasil baseline emulasi yang terbaru

## Latest Baseline Result

Baseline emulasi mobile Chrome sudah dijalankan.

Ringkasan cepat:

- cold route `/`, `/booking`, dan `/payment-gateway-preview` semuanya berada di sekitar `8 detik`
- login ke shell utama untuk `Owner` dan `Teknisi` berada di sekitar `17.4 detik`
- hotspot render terberat saat ini adalah `Monitoring Performance` dan `Payroll & Komisi`

Evidence:

- [MOBILE-CHROME-PERFORMANCE-BASELINE.md](D:/Polesheadlamp.id/File%20Review/MOBILE-CHROME-PERFORMANCE-BASELINE.md)
- [mobile-chrome-performance-baseline.json](D:/Polesheadlamp.id/File%20Review/artifacts/mobile-chrome-performance-baseline.json)
- [perf-mobile-baseline.mjs](D:/Polesheadlamp.id/scripts/perf-mobile-baseline.mjs)

## Why This Exists

Blueprint bisa membantu struktur performa secara tidak langsung, tetapi tidak otomatis menyelesaikan masalah lemot.

Karena itu, sebelum masuk eksekusi optimasi, kita perlu baseline yang membedakan:

- masalah struktur
- masalah fetch
- masalah rerender
- masalah page weight
- masalah integrasi live tertentu

## Measurement Targets

### Primary metrics

- first load time
- time to interactive yang terasa oleh user
- long tasks
- CPU spikes saat membuka halaman berat
- memory growth
- delay saat scrolling atau filter interaction

### Secondary metrics

- jumlah request awal
- ukuran bundle awal
- jumlah data yang dimuat saat boot
- waktu render untuk halaman besar
- waktu response untuk service penting

## Pages to Measure First

Urutan prioritas pengukuran:

1. login flow ke shell utama
2. dashboard
3. prospek
4. pesanan
5. unified ads monitoring
6. conversation live inbox
7. payroll
8. teknisi mobile

## Measurement Tools

Tools yang disarankan:

- Chrome DevTools Performance
- Chrome DevTools Network
- Chrome DevTools Memory
- remote debugging dari Android Chrome jika memungkinkan
- React Profiler untuk halaman yang dicurigai rerender berat

## Evidence to Capture

Untuk tiap halaman yang diuji, simpan:

- device atau kelas device yang dipakai
- mode jaringan
- screenshot Network summary
- screenshot Performance trace
- catatan jumlah request awal
- catatan gejala user-facing

## Initial Hypotheses from Current Architecture

Berdasarkan `CURRENT-ARCHITECTURE-MAP.md`, hipotesis awal bottleneck adalah:

### H1

Boot app memuat terlalu banyak data global lewat `MasterDataCtx`.

### H2

Shell berbasis `activeTab` membuat sebagian state global tetap hidup lebih luas dari yang diperlukan.

### H3

Halaman besar seperti `Pesanan`, `Schedule`, `Prospek`, `Payroll`, dan `UnifiedAdsMonitoringPage` membawa beban render yang tinggi.

### H4

Live integration, snapshot merging, dan realtime updates dapat menambah noise atau rerender di area tertentu.

### H5

Marketing OS dan host app memuat layer theme dan UI yang berbeda dalam satu runtime, yang bisa menambah cost render atau styling complexity di area tertentu.

## Baseline Procedure

### Step 1

Ukur cold start dari login sampai shell utama tampil.

### Step 2

Ukur load pertama untuk tiap halaman prioritas.

### Step 3

Ukur interaksi berat:

- buka filter
- buka dialog besar
- berpindah ke halaman berat
- memuat data live

### Step 4

Catat apakah masalah utama muncul dari:

- data load
- CPU render
- script execution
- network latency
- live integration wait

## Output Needed Before Optimization

Sebelum task optimasi dimulai, minimal harus ada:

- daftar halaman paling lambat
- daftar hipotesis bottleneck yang didukung evidence
- daftar area yang kemungkinan besar structural
- daftar area yang kemungkinan besar component-specific

## Relationship to Refactor Work

Dokumen ini dipakai untuk memutuskan:

- apakah task refactor tertentu layak diklaim membantu performa
- apakah masalah Chrome HP lebih banyak berasal dari shell/data architecture atau dari page tertentu
- task mana yang harus diprioritaskan jika targetnya adalah keluhan lemot

## Not a Fix Plan Yet

Dokumen ini bukan daftar solusi final.

Dokumen ini hanya memastikan bahwa nanti saat eksekusi:

- kita tidak menebak-nebak
- kita tidak memakai blueprint sebagai jawaban otomatis
- kita punya data sebelum mengubah struktur internal
