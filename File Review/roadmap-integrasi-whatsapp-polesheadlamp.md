# Roadmap Pengembangan
## Integrasi WhatsApp (Kirimdev) × Sistem Internal Restoration Headlamp Indonesia

**Brand:** polesheadlamp.id
**Versi dokumen:** Draft 1.0
**Tujuan:** Menghubungkan chat WhatsApp real-time dari Kirimdev ke sistem internal, lalu membangun lapisan otomasi (auto-capture customer, auto-link order, agent balas otomatis) dan lapisan analitik kinerja CS (kecepatan respon, kepatuhan SOP, titik chat mati) dari hulu ke hilir.

---

## Cara Membaca Dokumen Ini

Pengerjaan disusun **berurutan berdasarkan ketergantungan** — tiap tahap menumpuk di atas tahap sebelumnya. Mulai dari **Fondasi** (wajib beres dulu sebelum koding apa pun), lalu **Tahap 1–10** secara runut.

Tiap item diberi label prioritas:

- **[P0] Wajib** — fondasi inti, sistem tidak jalan tanpa ini.
- **[P1] Penting** — fitur utama yang jadi tujuan proyek.
- **[P2] Pengembangan** — peningkatan/analitik lanjutan, bisa menyusul.

---

## FONDASI — Disiapkan Sebelum Koding Dimulai

Bagian ini bukan tugas koding, melainkan prasyarat. Jika ini belum beres, pengembangan akan tersendat di tengah jalan.

**F1. Akses & kredensial Kirimdev [P0]**
Siapkan API key produksi, daftar `phone_number_id` untuk ke-7 nomor, dan URL endpoint webhook yang akan didaftarkan ke Kirimdev.

**F2. Pemetaan 7 nomor ke CS [P0]**
Buat tabel acuan: nomor mana milik CS siapa. Ini fondasi seluruh atribusi per-CS — tanpa ini, data kinerja tidak bisa dipisah per orang.

**F3. Infrastruktur hosting foto before-after [P0]**
Siapkan penyimpanan/CDN yang melayani foto lewat **URL HTTPS publik dan cepat**. WhatsApp mengambil gambar langsung dari URL tersebut; jika lambat atau berada di balik login, pengiriman akan gagal. Ini wajib ada sebelum fitur agent dibangun.

**F4. Definisi SOP funnel resmi [P0]**
Keputusan bisnis, bukan teknis. Tetapkan secara eksplisit: urutan tahap yang benar (salam → gali kebutuhan → kirim harga → nego → deal → penjadwalan → selesai) beserta aturan tiap tahap (mis. wajib gali kebutuhan sebelum harga, wajib follow-up bila customer diam). Tanpa definisi tajam ini, deteksi pelanggaran SOP tidak akan akurat.

**F5. Kebijakan & ambang batas [P0]**
Putuskan di awal agar metrik konsisten:
- Ambang **"chat mati"** (mis. 24–48 jam tanpa balasan customer).
- **Jam kerja/SLA** operasional CS (agar chat di luar jam tidak menghukum metrik kecepatan).
- Ambang **"respon lambat"** (mis. lebih dari 15 menit dalam jam kerja).
- Kebijakan **privasi & retensi** data chat (siapa boleh melihat apa, berapa lama disimpan).

**F6. Template WhatsApp [P1]**
Susun dan daftarkan template standar ke Meta untuk approval (follow-up harga, konfirmasi jadwal, dll). Wajib karena balasan di luar jendela 24 jam hanya boleh memakai template yang sudah disetujui.

---

## TAHAP 1 — Fondasi Data: Menangkap & Menyimpan Chat

Tujuan: setiap pesan masuk dan keluar tersimpan rapi dan terhubung ke CS serta customer yang tepat.

1. **[P0]** Bangun endpoint webhook untuk menerima event Kirimdev: pesan masuk, pesan keluar, dan status (sent/delivered/read).
2. **[P0]** Verifikasi HMAC signature pada setiap webhook untuk mencegah pihak luar menyuntikkan pesan palsu ke sistem.
3. **[P0]** Buat tabel pesan: id pesan, nomor CS (`phone_number_id`), nomor customer, arah (masuk/keluar), isi teks, timestamp, dan status.
4. **[P0]** Buat tabel percakapan yang mengelompokkan pesan per pasangan (customer × CS), dengan deduplikasi berbasis event id agar tidak ada pesan ganda.
5. **[P0]** Terapkan pemetaan `phone_number_id` → nama CS (dari Fondasi F2) sehingga atribusi per-CS berjalan otomatis.

---

## TAHAP 2 — Auto-Capture Data Customer

Tujuan: profil customer terbentuk sendiri begitu mereka mengirim chat pertama.

6. **[P1]** Saat chat masuk dari nomor baru, otomatis buat record customer: nomor HP (kunci utama), nama profil WhatsApp (`profile.name` — nama yang diatur sendiri oleh customer), CS pertama yang menangani, dan tanggal kontak pertama.
7. **[P1]** Jika nomor sudah ada, perbarui datanya — jangan membuat record baru. Nomor HP menjadi patokan agar tidak terjadi duplikasi.
8. **[P2]** Simpan nama profil WhatsApp apa adanya, namun sediakan kolom terpisah "nama versi CS" agar CS dapat merapikan nama tanpa menimpa data asli.
9. **[P2]** Bila memungkinkan, catat sumber/asal customer (Instagram, Google, iklan tertentu) untuk analisis channel di kemudian hari.

---

## TAHAP 3 — Auto-Link Chat ke Order & Jadwal Teknisi

Tujuan: percakapan otomatis tertaut ke order, dan closing tercatat tanpa input manual.

10. **[P0]** Pastikan form order + jadwal memiliki field nomor HP customer. Ini jembatan yang menghubungkan order ke percakapan.
11. **[P1]** Sistem mencocokkan order dengan customer berdasarkan nomor HP yang sama. Begitu cocok, percakapan dan order otomatis tertaut.
12. **[P1]** Saat order terbentuk, percakapan otomatis ditandai **CLOSING/DEAL**, lengkap dengan informasi: CS yang closing, waktu closing, dan order terkait.
13. **[P1]** Tampilkan pada profil customer: riwayat chat dan status terpadu (nego / deal / dijadwalkan / selesai) dalam satu layar.

---

## TAHAP 4 — Database Before-After (Dikelola Tim Creative)

Tujuan: pustaka before-after siap pakai sebagai bahan jualan otomatis.

14. **[P1]** Bangun database before-after: merk & tipe mobil, jenis pengerjaan (poles headlamp kuning, baret, jamur, dll), foto before (URL), foto after (URL), serta tag/kategori untuk pencarian.
15. **[P0]** Pastikan seluruh foto di-host publik via HTTPS dan cepat (lihat Fondasi F3) — karena WhatsApp mengambil foto langsung dari URL tersebut.
16. **[P1]** Bangun antarmuka khusus tim Creative untuk mengelola before-after (tambah, edit, beri tag, hapus), dengan login terpisah sesuai role.
17. **[P2]** Validasi setiap entri (foto dapat diakses, URL valid) sebelum boleh dipakai agent, agar tidak ada link mati saat balas otomatis.

---

## TAHAP 5 — Mode Agent Balas Otomatis

Tujuan: agent membantu merespons cepat dan mengirim before-after relevan, dengan CS tetap memegang kendali.

18. **[P1]** Bangun mode agent balas otomatis yang dapat diaktif/nonaktifkan per CS atau per nomor — CS tetap dapat mengambil alih percakapan secara manual kapan pun.
19. **[P1]** Agent membaca isi chat, memahami mobil dan masalah yang disebut customer, lalu mengambil before-after paling relevan dari database (pencocokan berdasarkan merk/tipe mobil + jenis pengerjaan).
20. **[P1]** Agent mengirim foto before-after via Kirimdev (memakai URL HTTPS publik) beserta caption yang sesuai.
21. **[P1]** Sediakan aturan fallback: bila tidak ditemukan before-after yang cocok, agent tidak menebak — melainkan menanyakan detail lebih lanjut ke customer atau mengoper ke CS manusia.
22. **[P0]** Pastikan agent mematuhi jendela 24 jam: balasan bebas hanya dalam 24 jam sejak pesan terakhir customer; di luar itu wajib memakai template.
23. **[P2]** Catat setiap balasan agent (apa yang dikirim, before-after mana) ke log percakapan agar ikut terhitung di analitik dan dapat diaudit.

---

## TAHAP 6 — Metrik Kecepatan Respon

Tujuan: ukur seberapa cepat tiap CS merespons, secara adil.

24. **[P1]** Hitung **First Response Time** — lama CS membalas chat pertama dari customer (metrik paling berpengaruh pada kesan awal).
25. **[P1]** Hitung **Average Response Time** — rata-rata kecepatan balasan sepanjang percakapan.
26. **[P0]** Terapkan jam kerja/SLA (dari Fondasi F5) — kecepatan respon hanya dihitung dalam jam operasional, agar chat di luar jam tidak menjatuhkan metrik secara tidak adil.
27. **[P1]** Tandai percakapan yang melewati ambang "respon lambat".
28. **[P2]** Kaitkan kecepatan respon dengan tingkat chat mati — apakah CS yang lebih lambat lebih sering kehilangan customer.
29. **[P2]** Tampilkan beban kerja per CS (jumlah chat aktif yang dipegang) sebagai konteks penilaian, agar CS dengan beban tinggi dinilai secara wajar.

---

## TAHAP 7 — SOP Funnel & Deteksi Pelanggaran

Tujuan: ketahuan CS mana yang keluar dari alur SOP dan apakah itu penyebab chat mati.

30. **[P1]** Terapkan SOP funnel resmi dari Fondasi F4 sebagai acuan sistem.
31. **[P1]** Bangun proses yang membandingkan tiap percakapan dengan SOP dan menandai penyimpangan: tahap terlewati, urutan terbalik, tidak follow-up, melewatkan before-after, dan sejenisnya.
32. **[P1]** Untuk setiap chat yang mati, catat apakah terdapat pelanggaran SOP sebelum kematiannya — guna memisahkan "mati karena customer tidak berminat" dari "mati karena CS salah menangani".
33. **[P2]** Buat kategori jenis pelanggaran agar dapat dihitung (mis. lambat respon, lewat gali kebutuhan, tidak follow-up, langsung memberi harga).
34. **[P2]** Hitung skor kepatuhan SOP per CS dan kaitkan dengan tingkat chat mati.

---

## TAHAP 8 — Funnel & Penentuan Status Mati

Tujuan: setiap percakapan punya status dan tahap yang jelas.

35. **[P0]** Terapkan aturan "mati" dari Fondasi F5 (jam tanpa balasan customer) sebagai parameter yang dapat diubah.
36. **[P1]** Implementasikan tahap funnel resmi: salam awal → gali kebutuhan → kirim harga → nego → deal → penjadwalan → selesai.
37. **[P1]** Tetapkan logika status: order = sinyal DEAL otomatis; percakapan tanpa order yang customer-nya berhenti membalas melewati ambang = MATI di tahap terakhirnya.

---

## TAHAP 9 — Klasifikasi Tahap Percakapan (Lanjutan)

Tujuan: menerjemahkan chat free-text menjadi data terstruktur yang bisa dianalisis.

38. **[P1]** Bangun proses yang mengambil transkrip tiap percakapan, mengirimnya ke LLM, dan mengembalikan hasil terstruktur: tahap terjauh, status (mati/jalan/deal), alasan mati, serta pelanggaran SOP yang terdeteksi.
39. **[P1]** Simpan hasil klasifikasi ke database dan jalankan ulang otomatis setiap ada perkembangan chat baru.
40. **[P1]** Sediakan mekanisme pengecekan manual atas sampel hasil klasifikasi untuk memastikan akurasi — bagian ini perlu beberapa kali iterasi dan kalibrasi.

---

## TAHAP 10 — Hilir: Dashboard & Analitik

Tujuan: manajer melihat kinerja dari hulu ke hilir dalam satu tampilan.

41. **[P1]** Persentase percakapan mati di tiap tahap, per CS.
42. **[P1]** Heatmap CS × tahap, diwarnai berdasarkan persentase — titik dengan konsentrasi masalah tertinggi otomatis berwarna merah.
43. **[P1]** Ringkasan per CS, contoh: "CS B — 40% mati di tahap harga, 60% di antaranya karena tidak follow-up, rata-rata respon 22 menit."
44. **[P1]** Conversion rate otomatis per CS: dari sekian chat masuk, berapa persen menjadi order.
45. **[P2]** Tampilkan skor kepatuhan SOP dan kecepatan respon per CS, beserta jenis pelanggaran yang paling sering menyebabkan chat mati.
46. **[P2]** Ukur efektivitas before-after: apakah chat yang dikirimi before-after lebih tinggi closing-nya, dan before-after mobil mana yang paling sering menghasilkan deal.
47. **[P2]** Analitik jam sibuk (kapan chat paling banyak masuk — untuk pengaturan shift) dan analitik channel (sumber mana paling banyak closing).
48. **[P0]** Terapkan akses berbasis role: manajer CS melihat seluruh aktivitas; tiap CS hanya melihat datanya sendiri; tim Creative mengelola before-after.

---

## TAHAP 11 — Operasional & Pengamanan

Tujuan: sistem tetap andal dan tertib di produksi.

49. **[P0]** Penanganan jendela 24 jam: tandai percakapan yang telah melewati 24 jam dan ingatkan CS bahwa balasan harus memakai template.
50. **[P1]** Pastikan template WhatsApp (Fondasi F6) telah aktif dan dapat dipanggil dari sistem.
51. **[P0]** Logging dan alert bila webhook gagal/terlambat atau pengiriman foto gagal, agar tidak ada chat yang terlewat.
52. **[P1]** Terapkan kebijakan privasi & retensi data (Fondasi F5): batasi akses sesuai role dan tetapkan masa simpan data chat customer.

---

## Catatan Teknis Penting (Ringkasan)

- **Atribusi per-CS otomatis.** Karena setiap CS membalas dari nomornya sendiri, `phone_number_id` pada tiap pesan sudah menandai CS-nya. Manfaatkan ini sebagai sumber kebenaran, bukan input manual.
- **Nomor HP adalah kunci utama**, bukan nama. Nama profil WhatsApp dapat berubah-ubah; seluruh pencocokan (customer, order, riwayat) sebaiknya berbasis nomor HP.
- **Jendela 24 jam** adalah batasan Meta, bukan Kirimdev. Berlaku untuk balasan CS maupun agent. Lewat 24 jam = wajib template approved.
- **Foto before-after via URL.** WhatsApp menarik gambar dari URL publik HTTPS Anda secara server-side. Hosting yang lambat atau terkunci login menyebabkan kegagalan kirim — jadikan kecepatan & aksesibilitas CDN sebagai prioritas.
- **Verifikasi HMAC wajib.** Tanpa verifikasi signature, endpoint webhook rawan disusupi pesan palsu.
- **Idempotency.** Manfaatkan event id untuk deduplikasi pesan dan, pada sisi pengiriman, hindari pesan ganda saat terjadi retry.

---

## Urutan Pengerjaan yang Disarankan

1. **Selesaikan seluruh Fondasi (F1–F6)** — terutama F1–F5 yang berlabel P0.
2. **Tahap 1 → 2 → 3** membangun tulang punggung data (chat, customer, order). Ini harus solid sebelum apa pun di atasnya.
3. **Tahap 8** (status & funnel dasar) dapat berjalan beriringan dengan Tahap 3.
4. **Tahap 4 → 5** menambahkan before-after dan agent setelah data inti stabil.
5. **Tahap 6 → 7 → 9** membangun lapisan pengukuran (kecepatan, SOP, klasifikasi).
6. **Tahap 10 → 11** menutup dengan dashboard dan pengamanan operasional.

Item berlabel **P2** dapat dijadwalkan menyusul tanpa menghambat peluncuran fungsi inti.
