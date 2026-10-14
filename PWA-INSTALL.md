# Pasang Website RT sebagai aplikasi di HP (PWA)

Project ini sudah dilengkapi manifest PWA, ikon aplikasi, dan service worker. Setelah deploy ke hosting HTTPS (misalnya Vercel), warga dapat menambahkan portal ke layar utama tanpa membuat aplikasi Android/iOS terpisah.

## Deploy
1. Salin file dan folder dari ZIP ke repository GitHub dengan mempertahankan struktur.
2. Pastikan file `manifest.webmanifest`, `sw.js`, folder `icons/`, dan `assets/pwa-register.js` ikut ter-upload.
3. Commit perubahan dan tunggu deployment Vercel berhasil.
4. Buka URL utama website HTTPS dari HP, lalu ikuti langkah sesuai perangkat.

## Android (Chrome / Edge)
1. Buka website di Chrome atau Edge.
2. Buka menu browser (⋮).
3. Pilih **Install app / Pasang aplikasi** atau **Tambahkan ke layar utama**.
4. Konfirmasi. Ikon **Dusun Dawung** akan muncul di layar utama seperti aplikasi.

## iPhone (Safari)
1. Buka website menggunakan Safari.
2. Ketuk tombol **Bagikan** (kotak dengan panah ke atas).
3. Pilih **Tambahkan ke Layar Utama**.
4. Pastikan nama **Dusun Dawung**, lalu ketuk **Tambah**.

Catatan: instalasi memerlukan situs menggunakan HTTPS. Pada iPhone, gunakan Safari untuk proses Tambahkan ke Layar Utama. Akses data, pengajuan surat, galeri, dan fitur lain tetap membutuhkan koneksi internet. Service worker menyimpan sebagian aset untuk membantu pemuatan dan fallback dasar saat offline; ini bukan pengganti koneksi Supabase.
