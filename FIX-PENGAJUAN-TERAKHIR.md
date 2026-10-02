# Fix Terakhir Menu Pengajuan Surat

Patch dibuat dari ZIP project yang sedang digunakan.

Perubahan utama:
- admin/index.html memakai event delegation global (capture) untuk #adminNav a[data-page="surat"].
- Saat diklik, halaman langsung menampilkan state Memuat sebelum memanggil renderPelayananAdmin.
- Jika fungsi tidak tersedia atau error, error ditampilkan di area aplikasi.
- login.js konsisten mengizinkan role super_admin dan mengarahkannya ke admin.

Tidak ada perubahan schema/database pada patch ini.
