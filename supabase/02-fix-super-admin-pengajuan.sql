-- Jalankan di Supabase SQL Editor bila akun super_admin sudah dibuat.
-- Perubahan ini tidak menghapus data.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

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
