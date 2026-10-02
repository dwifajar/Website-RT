# Deploy ke Supabase

1. Buat project Supabase baru.
2. Buka SQL Editor.
3. Jalankan `supabase/schema.sql`.
4. Buka Authentication > Providers > Email dan aktifkan Email.
5. Salin URL project dan publishable/anon key ke:
   `assets/config.js` sudah diisi dengan Project URL dan publishable key yang Anda berikan.
6. Untuk produksi, jangan commit `config.js` jika menggunakan secret lain.
   Publishable/anon key memang boleh ada di browser, tetapi RLS wajib aktif.
7. Buat akun admin pertama di Authentication > Users.
8. Setelah akun dibuat, insert profile admin melalui SQL:
   insert into public.profiles(id,nama,email,role)
   values ('UUID_USER','Admin Pengurus','admin@dawung.id','admin');
9. Hubungkan form frontend ke tabel Supabase sesuai schema.
10. Hosting dapat menggunakan Netlify, Vercel, Cloudflare Pages, atau server biasa.

## Rekomendasi tahap berikutnya
- Nomor surat otomatis + PDF resmi.
- Upload KTP/KK/bukti pembayaran ke Supabase Storage.
- WhatsApp notification.
- Dashboard statistik real-time.
- Export Excel/PDF.
- Backup dan audit log.
- PWA/installable mobile.
