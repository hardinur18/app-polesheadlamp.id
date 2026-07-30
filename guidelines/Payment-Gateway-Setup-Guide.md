# Panduan Setup Payment Gateway (QRIS via Xendit)

## A. Mendapatkan API Key Xendit

### Step 1: Buat atau Login Akun Xendit
1. Buka [dashboard.xendit.co](https://dashboard.xendit.co)
2. Klik **Sign Up** jika belum punya akun, atau **Login** jika sudah
3. Lengkapi verifikasi bisnis jika diminta

### Step 2: Generate Secret API Key
1. Di sidebar kiri, klik **Settings**
2. Pilih tab **Developers** → klik **API Keys**
3. Klik tombol **Generate Secret Key**
4. Pilih mode:
   - **Development** → untuk testing (transaksi tidak nyata)
   - **Production** → untuk transaksi nyata (uang asli)
5. Copy **Secret Key** yang muncul (hanya ditampilkan sekali!)

### Step 3: Masukkan API Key ke Aplikasi
1. Buka aplikasi → menu **Keuangan** → **Payment Gateway**
2. Paste Secret Key ke kolom **Secret API Key**
3. Klik tombol **Test** untuk memverifikasi koneksi
4. Jika berhasil, akan muncul saldo akun Xendit Anda

---

## B. Setting Webhook di Xendit

Webhook memungkinkan Xendit mengirim notifikasi otomatis ke sistem saat pembayaran berhasil.

### Step 1: Salin Webhook URL
1. Di halaman **Payment Gateway** aplikasi, scroll ke bagian **Webhook URL**
2. Klik tombol **Copy** untuk menyalin URL

### Step 2: Pasang di Xendit Dashboard
1. Buka [dashboard.xendit.co](https://dashboard.xendit.co)
2. Pergi ke **Settings** → **Developers** → **Callbacks**
3. Cari bagian **Payment Request** (atau **Payment**)
4. Klik **Edit URL**
5. Paste Webhook URL yang sudah disalin
6. Pastikan status callback menjadi **Active** (hijau)

### Step 3: Salin Webhook Verification Token
1. Di halaman Callbacks Xendit, cari **Webhook Verification Token**
2. Klik **Show** lalu copy token tersebut
3. Kembali ke aplikasi, paste di kolom **Webhook Verification Token**

### Step 4: Simpan
1. Klik tombol **Simpan Pengaturan** (tombol oranye di bawah)

---

## C. Mengaktifkan Payment Gateway

1. Di halaman **Payment Gateway**, aktifkan toggle **Aktifkan Payment Gateway**
2. Badge status akan berubah dari "Nonaktif" menjadi "Aktif"
3. Fitur QRIS akan otomatis muncul di halaman **Pesanan** (ikon kartu kredit)

---

## D. Isi Informasi Bisnis & Rekening

### Informasi Bisnis
- **Nama Merchant**: Nama yang ditampilkan di halaman pembayaran pelanggan

### Rekening Bank Tujuan
- **Nama Bank**: Bank penerima dana (BCA, BRI, Mandiri, dll)
- **Nomor Rekening**: Nomor rekening bisnis Anda
- **Atas Nama**: Nama pemilik rekening

> Informasi rekening ini disimpan sebagai referensi internal. Dana QRIS masuk ke akun Xendit Anda, lalu bisa di-withdraw ke rekening ini via Dashboard Xendit.

---

## E. Cara Menggunakan QRIS di Pesanan

1. Buka halaman **Pesanan**
2. Klik ikon **kartu kredit** (💳) pada baris pesanan
3. Dialog pembayaran akan terbuka
4. Klik **Generate QRIS** untuk membuat kode QR
5. Pelanggan scan QR code menggunakan:
   - GoPay, OVO, DANA, ShopeePay, LinkAja
   - Mobile banking (BCA, BRI, Mandiri, BNI, dll)
   - Aplikasi apapun yang mendukung QRIS
6. Setelah bayar, status akan otomatis terupdate via webhook

---

## F. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Test koneksi gagal | Pastikan API Key benar dan belum expired |
| QRIS tidak muncul di pesanan | Pastikan toggle Payment Gateway sudah **Aktif** |
| Status bayar tidak terupdate | Periksa webhook URL sudah terpasang dan **Active** di Xendit |
| Saldo tidak masuk | Cek di Xendit Dashboard → Balance. Withdrawal dilakukan manual |

---

## G. Role Permission

Fitur Payment Gateway memerlukan permission berikut:

| Permission | Deskripsi | Role Default |
|-----------|-----------|-------------|
| `payment_gateway.view` | Akses halaman Payment Gateway | Owner, Super Admin, Finance |
| `payment_gateway.manage` | Ubah konfigurasi gateway | Owner, Super Admin, Finance |
| `order.payment.qris.view` | Lihat panel QRIS di pesanan | Owner, Super Admin, Admin PIC, Finance, CS |
| `order.payment.qris.generate` | Generate QRIS baru | Owner, Super Admin, Admin PIC, Finance, CS |
| `order.payment.qris.refresh` | Refresh status QRIS | Owner, Super Admin, Admin PIC, Finance, CS |
| `order.payment.qris.cancel` | Batalkan QRIS aktif | Owner, Super Admin, Admin PIC, Finance, CS |
