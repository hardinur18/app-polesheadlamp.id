# Mobile Chrome Performance Baseline for Polesheadlamp.id

Status: Active baseline summary
Date: 2026-04-21
Scope: First-pass performance baseline with mobile Chrome emulation
Document role: Active summary for Chrome HP slowness discussion

## Method

- Preview target: `http://localhost:4173`
- Browser: local Chrome headless
- Emulation: `412x915`, device scale factor `2.625`
- CPU throttle: `4x`
- Network profile: `150 ms` latency, `1.6 Mbps` down, `0.75 Mbps` up
- Auth setup: temporary `Owner` and `Teknisi` accounts created for measurement and deleted again after run
- Raw artifact: [mobile-chrome-performance-baseline.json](</D:/Polesheadlamp.id/File Review/artifacts/mobile-chrome-performance-baseline.json>)
- Repeatable script: [perf-mobile-baseline.mjs](</D:/Polesheadlamp.id/scripts/perf-mobile-baseline.mjs>)

Catatan penting:

- ini baseline emulasi, bukan real-device field trace
- angka ini tetap berguna untuk membandingkan area berat secara relatif
- untuk klaim final di Android Chrome nyata, tetap idealnya ditambah trace dari device fisik

## Cold Route Baseline

| Scenario | DCL | FCP | LCP | Long Tasks | Reading |
|---|---:|---:|---:|---:|---|
| `/` login | `7887 ms` | `8060 ms` | `8460 ms` | `1267 ms` | cold start publik berat |
| `/booking` | `7807 ms` | `8124 ms` | `8124 ms` | `1098 ms` | sama berat dengan root |
| `/payment-gateway-preview` | `7854 ms` | `8436 ms` | `8436 ms` | `1378 ms` | paling berat di public surface |

Temuan utama cold route:

- ketiga route publik sama-sama membawa beban cold start sekitar `8 detik`
- transfer awal konsisten di sekitar `1334 KB`, yang menunjukkan public surface masih ikut menarik beban SPA utama
- problem public route saat cold load lebih terlihat sebagai `page weight / bundle weight`, bukan masalah satu halaman spesifik

## Auth and Shell Baseline

| Scenario | Visible Time | Resource Delta | Long Task Delta | Reading |
|---|---:|---:|---:|---|
| Owner login -> shell | `17428 ms` | `41` | `142 ms` | masuk shell sangat lambat |
| Teknisi login -> shell | `17425 ms` | `41` | `141 ms` | bottleneck boot mirip Owner |
| Owner -> Dashboard | `2626 ms` | `0` | `567 ms` | dashboard terasa sedang |
| Owner -> Prospek | `2221 ms` | `0` | `171 ms` | relatif paling ringan |
| Owner -> Pesanan | `3005 ms` | `0` | `913 ms` | render/data UI sudah terasa berat |
| Owner -> Monitoring Performance | `7050 ms` | `2` | `4388 ms` | hotspot utama |
| Owner -> Payroll | `5951 ms` | `3` | `3406 ms` | hotspot utama |
| Owner -> Marketing OS Conversation Hub | `3291 ms` | `3` | `226 ms` | DOM besar, visible time menengah |
| Teknisi -> Jadwal Saya | `2136 ms` | `4` | `87 ms` | relatif ringan dibanding halaman Owner |

## Heaviest Areas Right Now

Urutan area paling berat dari baseline ini:

1. `login -> shell` untuk `Owner` dan `Teknisi` sekitar `17.4 detik`
2. `Monitoring Performance` sekitar `7.0 detik`
3. `Payroll & Komisi` sekitar `6.0 detik`
4. `Marketing OS / Conversation Hub` sekitar `3.3 detik`
5. `Pesanan` sekitar `3.0 detik`

## Strong Signals From the Data

### 1. Shell boot is the biggest bottleneck

Login ke shell butuh sekitar `17.4 detik` untuk `Owner` dan `Teknisi`, dengan delta resource sekitar `41`.

Artinya:

- problem terbesar bukan cuma halaman tertentu
- boot auth + shell + data awal kemungkinan terlalu berat
- hipotesis `MasterDataCtx` dan eager load global makin kuat

### 2. In-shell lag is dominated by CPU/render, not network

Di banyak perpindahan halaman, `transferSizeKbDelta` hampir nol, tetapi `taskDuration` dan `longTask` tetap tinggi.

Artinya:

- bottleneck utama di shell bukan request jaringan tambahan
- bottleneck utama lebih dekat ke `script execution`, `render`, `layout`, dan `DOM work`

### 3. Monitoring Performance and Payroll are the clearest component hotspots

Angka penting:

- `Monitoring Performance`: `7050 ms` visible time, `4388 ms` long tasks, `35.41 MB` heap end, `12270` nodes
- `Payroll & Komisi`: `5951 ms` visible time, `3406 ms` long tasks, `31.04 MB` heap end, `12361` nodes

Ini dua kandidat terkuat untuk profiling lebih detail di level komponen.

### 4. Orders and Conversation Hub are also heavy, but differently

Angka penting:

- `Pesanan`: `3005 ms`, heap end `33.27 MB`, nodes `7334`
- `Conversation Hub`: `3291 ms`, heap end `32.42 MB`, nodes `12756`

Interpretasi awal:

- `Pesanan` cenderung berat karena render tabel/list + state layar
- `Conversation Hub` punya tekanan DOM tinggi walau `long task` tidak separah Monitoring/Payroll

### 5. Public surfaces are paying for the main app bundle

Karena `/`, `/booking`, dan `/payment-gateway-preview` semua berada di kisaran `8 detik` cold load dengan transfer awal serupa, baseline ini memberi sinyal kuat bahwa:

- public route belum benar-benar ringan
- route-level isolation atau code-splitting kemungkinan bernilai tinggi nanti

## Structural vs Component-Specific Reading

### Structural

- boot auth + shell terlalu berat
- public route ikut membawa beban bundle besar
- state dan UI shell kemungkinan terlalu lama hidup / terlalu banyak dibangun di awal

### Component-Specific

- `Monitoring Performance`
- `Payroll & Komisi`
- `Pesanan`
- `Marketing OS / Conversation Hub`

## What This Means for the Blueprint

Blueprint tidak menyelesaikan lemot secara otomatis.

Dari baseline ini, blueprint kemungkinan membantu:

- **tidak langsung**, lewat perapihan boundary shell/data layer
- **tidak langsung**, lewat pengurangan eager boot dan coupling
- **langsung hanya kalau** batch berikutnya benar-benar menyasar hotspot render dan page weight

Jadi kesimpulannya:

> Blueprint berguna sebagai enabler struktur optimasi, bukan solusi performa otomatis.

## Recommended Next Moves

1. Profiling khusus `login -> shell` untuk menghitung eager fetch dan cost `MasterDataCtx`.
2. Profiling render khusus `Monitoring Performance`.
3. Profiling render khusus `Payroll & Komisi`.
4. Audit bundle/public route agar `/booking` dan `/payment-gateway-preview` tidak ikut menarik beban yang sama besar dengan app utama.
5. Jika perlu validasi akhir, ambil trace dari Android Chrome nyata untuk membandingkan dengan baseline emulasi ini.
