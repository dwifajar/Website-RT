-- FIX: Pengajuan Surat untuk Super Admin
-- Jalankan file ini di Supabase SQL Editor pada project RT Dawung.
-- Tidak menghapus atau mengubah data surat_pengajuan.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin','ketua_rt','super_admin')
  );
$$;

-- Pastikan policy admin pada surat_pengajuan memakai helper yang sudah diperbarui.
drop policy if exists "admin manage surat" on public.surat_pengajuan;
create policy "admin manage surat"
on public.surat_pengajuan
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
