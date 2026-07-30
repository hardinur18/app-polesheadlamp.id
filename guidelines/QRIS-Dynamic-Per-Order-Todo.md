# QRIS Dinamis Per Order

Dokumen ini sudah saya ubah dari planning-only menjadi tracker implementasi aktif.

Scope saat ini:
- Fokus ke `QRIS dinamis per order`
- Skip `rekening statis / transfer manual`
- Target: setiap pesanan bisa generate QRIS sendiri sesuai nominal order

## Status Implementasi
- Provider default diputuskan ke `Xendit Payments API (QRIS)` dengan fallback `mock` jika secret gateway belum diisi.
- UI QRIS sekarang dibuka lewat `ikon pembayaran` khusus di tabel `Pesanan`, terpisah dari modal detail umum.
- Backend route QRIS sudah dibuat di edge function.
- Migration `payment_transactions` sudah disiapkan.
- Integrasi live penuh masih butuh `XENDIT_SECRET_KEY` dan `XENDIT_WEBHOOK_TOKEN`.
- Verifikasi frontend sudah lolos via `npm run build`.
- Verifikasi edge function belum bisa dieksekusi lokal dari sesi ini karena `deno` belum tersedia di environment shell.

## Target Produk
- [x] Setiap `order` bisa punya tagihan QRIS sendiri
- [x] Nominal QRIS selalu mengikuti nilai tagihan order
- [x] Customer bisa scan QR langsung dari halaman/detail pesanan
- [x] Status pembayaran bisa update otomatis ke sistem
- [x] QRIS bisa punya masa berlaku dan status expired

## Keputusan Bisnis
- [x] Tentukan provider payment gateway yang support `QRIS dinamis`
  Provider yang dipakai: `Xendit`
- [x] Tentukan apakah versi awal hanya support `full payment`
  V1 fokus ke `full payment`, tetapi sinkronisasi order sudah toleran jika ada pembayaran parsial/sisa tagihan
- [x] Tentukan apakah perlu support `DP` dan `pelunasan` di fase berikutnya
  `DP/pelunasan` masuk fase berikutnya
- [x] Tentukan masa aktif QRIS, misalnya `15 menit`, `1 jam`, atau `24 jam`
  Untuk Xendit QRIS dipakai masa aktif default provider `48 jam`, bukan custom expiry per order
- [x] Tentukan siapa yang boleh `generate`, `regenerate`, dan `cancel` tagihan
  Generate/regenerate: `Owner`, `Super Admin`, `Admin PIC`, `Finance`, `CS`
  Cancel: `Owner`, `Super Admin`, `Admin PIC`, `Finance`
- [x] Tentukan aturan jika harga order berubah setelah QRIS sudah dibuat
  Panel akan memberi warning mismatch nominal dan regenerate akan mensupersede QR lama di sistem

## Struktur Data
- [x] Tambah tabel `payment_transactions` atau `order_payments`
- [x] Tambah relasi `order_id -> orders.id`
- [x] Simpan `amount`
- [x] Simpan `gateway_provider`
- [x] Simpan `payment_method` = `qris`
- [x] Simpan `external_reference_id`
- [ ] Simpan `invoice_number` atau `merchant_ref`
- [x] Simpan `qr_string` atau `qr_image_url`
- [x] Simpan `expiry_at`
- [x] Simpan `paid_at`
- [x] Simpan `status` seperti `pending`, `paid`, `expired`, `failed`, `cancelled`
- [x] Simpan `provider_payload` untuk audit/debug
- [x] Siapkan tabel log webhook jika dibutuhkan
  Webhook log sementara disimpan ke KV edge function

## Aturan Sistem
- [x] Satu order hanya boleh punya `satu QRIS aktif` pada satu waktu
- [x] Regenerate QRIS harus otomatis menonaktifkan QR lama
- [x] Order yang sudah `paid` tidak boleh generate QR baru tanpa alasan khusus
- [x] Callback/payment notification harus `idempotent`
- [x] Nominal yang dibayar harus divalidasi terhadap order/transaction

## Backend API
- [x] Buat endpoint `create QRIS payment` per order
- [x] Buat endpoint `get payment status` per order
- [x] Buat endpoint `webhook callback` dari payment gateway
- [x] Tambahkan validasi signature/auth webhook
- [x] Tambahkan retry-safe handler untuk callback duplikat
- [x] Tambahkan fungsi `expire payment` bila lewat masa aktif
- [x] Tambahkan fungsi `regenerate QRIS`

## UI / Frontend
- [x] Tambah entry point QRIS yang rapi di halaman pesanan
  Dipakai lewat ikon `payment/credit card` di samping tombol mata
- [x] Tambah tampilan modal/card untuk QRIS aktif
- [x] Tampilkan `nominal`, `status`, dan `masa berlaku`
- [x] Tampilkan QR yang siap di-scan customer
- [x] Tambah tombol `Refresh Status`
- [x] Tambah tombol `Generate Ulang` jika expired
- [x] Tambah badge status pembayaran di halaman pesanan
- [x] Tampilkan histori payment transaction jika order pernah regenerate QR

## Integrasi Pesanan
- [x] Sinkronkan `paymentStatus` order saat payment transaction berubah
- [x] Jika payment sukses, update order ke status pembayaran yang sesuai
- [x] Jika payment expired, tandai transaksi expired tanpa mengubah order menjadi paid
- [x] Jika order dibatalkan, tagihan QRIS aktif harus ikut dinonaktifkan
- [ ] Jika nominal order berubah, sistem harus memaksa generate ulang QRIS
  Saat ini sistem memberi warning mismatch dan menyiapkan regenerate dari panel QRIS

## Notifikasi & Audit
- [ ] Kirim notifikasi ke CS/Admin saat payment sukses
- [ ] Simpan audit log saat QRIS dibuat
- [ ] Simpan audit log saat QRIS diregenerate
- [x] Simpan audit log saat webhook sukses masuk
- [ ] Simpan audit log saat payment berhasil / gagal / expired

## Security
- [x] Simpan secret key gateway di environment variable
- [x] Jangan expose secret ke frontend
- [x] Verifikasi semua callback/webhook
- [x] Validasi reference transaction sebelum update order
- [x] Batasi endpoint internal hanya untuk role yang berwenang

## Testing
- [ ] Test generate QRIS untuk nominal order berbeda-beda
- [ ] Test scan dan payment sukses di sandbox
- [ ] Test callback masuk dan status order ikut berubah
- [ ] Test callback ganda agar tidak double update
- [ ] Test QRIS expired
- [ ] Test regenerate QRIS setelah expired
- [ ] Test order dibatalkan saat masih ada QRIS aktif
- [ ] Test perubahan nominal order setelah QRIS dibuat
- [x] Test build frontend (`npm run build`)

## Deployment
- [ ] Siapkan akun production payment gateway
- [ ] Siapkan callback URL production
- [x] Tambah env sandbox dan production
- [x] Tambah migration database
- [ ] Tambah monitoring untuk transaksi payment pertama di production

## MVP yang Disarankan
- [x] V1 hanya support `full payment`
- [x] V1 hanya support `1 QRIS aktif per order`
- [x] V1 update status otomatis lewat webhook
- [x] V1 tampilkan QRIS di detail pesanan, belum perlu invoice page terpisah
- [x] V1 fokus ke alur `pending -> paid / expired`

## Catatan Lanjutan
- [ ] Fase 2 bisa tambah `DP` dan `pelunasan`
- [ ] Fase 2 bisa tambah `payment link` selain QRIS
- [ ] Fase 2 bisa tambah notifikasi WhatsApp otomatis berisi link/QR pembayaran
