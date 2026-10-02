# FIX PENGAJUAN SURAT — 03 Okt 2026

Masalah yang ditangani:
- Menu Pengajuan Surat tidak lagi bergantung pada router SPA.
- Klik menu Pengajuan Surat memakai navigasi HTML biasa ke `admin/pengajuan.html`.
- Dashboard -> Pengajuan Surat juga membuka halaman yang sama.
- Halaman `admin/pengajuan.html` memakai sidebar yang sama dengan Dashboard.
- `assets/admin-pengajuan.js` menangani data dari Supabase pada halaman tersebut.

Deployment:
1. Ganti seluruh isi repository GitHub dengan isi folder ini.
2. Tunggu Vercel selesai deploy.
3. Buka `/admin/`, login, klik Pengajuan Surat.
4. Bila halaman terbuka tetapi data menampilkan error permission untuk `super_admin`, jalankan `supabase/02-fix-super-admin-pengajuan.sql` di Supabase SQL Editor.
