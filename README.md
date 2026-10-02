# Portal Digital Dusun Dawung — Full Feature UI
RT 04 / RW 01 · “Sepi Ing Pamrih, Rame Ing Gawe”

## Yang sudah berfungsi di demo
- Beranda publik responsive
- Login role Warga / Pengurus
- Dashboard admin
- Data warga: tambah, edit, hapus, pencarian
- Kartu keluarga
- Pengajuan surat: tambah, status, cetak surat
- Agenda: tambah, hapus
- Pengumuman: tambah, hapus
- Kas & keuangan: transaksi, saldo, pemasukan/pengeluaran
- Aspirasi & laporan: ubah status
- Pengguna & role
- Pengaturan identitas portal
- Dashboard warga
- Pengajuan surat dari warga
- Aspirasi dari warga
- Penyimpanan demo memakai localStorage

## Akun demo
Admin:
admin@dawung.id / admin123

Warga:
warga@dawung.id / warga123

## Catatan produksi
Versi ini adalah frontend/demo yang siap dijadikan dasar aplikasi produksi. Data demo disimpan di browser (localStorage), bukan database online.
Untuk produksi, sambungkan:
1. Supabase Auth untuk login/reset password.
2. PostgreSQL/Supabase tables untuk warga, KK, surat, agenda, pengumuman, transaksi, aspirasi.
3. Row Level Security (RLS) untuk membatasi akses warga/admin.
4. Storage untuk dokumen/foto/bukti transaksi.
5. Edge Functions/server-side logic untuk nomor surat, PDF, notifikasi, dan audit log.
Jangan pernah menaruh service_role key di frontend.

## Warga + Kartu Keluarga (Supabase)

1. Di Supabase project RT Dawung, buka SQL Editor.
2. Jalankan `supabase/01-warga-kk-migration.sql`.
3. Pastikan hasil verifikasi menampilkan tabel `profiles`, `kartu_keluarga`, dan `warga`.
4. Commit/push seluruh folder website ke GitHub.
5. Vercel akan redeploy otomatis.
6. Login sebagai Admin lalu buka **Data Warga** dan **Kartu Keluarga**. CRUD sekarang menggunakan Supabase, bukan localStorage.

Data NIK dan No. KK divalidasi sebagai 16 digit di database. RLS membatasi CRUD warga/KK ke Admin/Ketua RT; warga biasa hanya dapat melihat/mengubah baris warga yang tertaut ke akun mereka sendiri.
