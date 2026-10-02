-- PORTAL RT DAWUNG: WARGA + KARTU KELUARGA
-- Jalankan di Supabase project RT Dawung: nqhvjilmdknbzzyjytdx
-- Aman dijalankan pada database baru maupun database yang sudah memiliki tabel dasar.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('warga','admin','ketua_rt');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.record_status as enum ('aktif','nonaktif');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text,
  role public.user_role not null default 'warga',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kartu_keluarga (
  id uuid primary key default gen_random_uuid(),
  no_kk text unique not null,
  kepala_keluarga text not null,
  alamat text not null default 'Dusun Dawung',
  rt text not null default '04',
  rw text not null default '01',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warga (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  nik text unique,
  nama text not null,
  no_kk text references public.kartu_keluarga(no_kk) on update cascade on delete set null,
  alamat text not null default 'Dusun Dawung',
  rt text not null default '04',
  rw text not null default '01',
  status public.record_status not null default 'aktif',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.kartu_keluarga enable row level security;
alter table public.warga enable row level security;

create or replace function public.is_rt_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','ketua_rt')
  );
$$;

revoke all on function public.is_rt_admin() from public;
grant execute on function public.is_rt_admin() to authenticated;

drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "admin read profiles" on public.profiles;
drop policy if exists "admin update profiles" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "admin read profiles" on public.profiles for select to authenticated using (public.is_rt_admin());

-- Kartu Keluarga: hanya admin/ketua RT yang dapat CRUD.
drop policy if exists "admin manage kk" on public.kartu_keluarga;
drop policy if exists "admin select kk" on public.kartu_keluarga;
create policy "admin manage kk" on public.kartu_keluarga for all to authenticated using (public.is_rt_admin()) with check (public.is_rt_admin());

-- Warga: admin/ketua RT CRUD; warga hanya boleh melihat/mengubah baris yang tertaut ke akun sendiri.
drop policy if exists "admin manage warga" on public.warga;
drop policy if exists "own warga read" on public.warga;
drop policy if exists "own warga update" on public.warga;
create policy "admin manage warga" on public.warga for all to authenticated using (public.is_rt_admin()) with check (public.is_rt_admin());
create policy "own warga read" on public.warga for select to authenticated using (profile_id = auth.uid());
create policy "own warga update" on public.warga for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Least-privilege grants for browser clients. RLS remains the actual data boundary.
grant select, insert, update, delete on public.warga to authenticated;
grant select, insert, update, delete on public.kartu_keluarga to authenticated;
grant select, update on public.profiles to authenticated;

-- Updated-at helper.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_warga_updated_at on public.warga;
create trigger trg_warga_updated_at before update on public.warga for each row execute function public.set_updated_at();
drop trigger if exists trg_kk_updated_at on public.kartu_keluarga;
create trigger trg_kk_updated_at before update on public.kartu_keluarga for each row execute function public.set_updated_at();

-- Validation helpers.
create or replace function public.validate_rt_warga()
returns trigger language plpgsql as $$
begin
  if new.nik is not null and (length(new.nik) <> 16 or new.nik !~ '^[0-9]+$') then
    raise exception 'NIK harus 16 digit angka';
  end if;
  if new.no_kk is not null and (length(new.no_kk) <> 16 or new.no_kk !~ '^[0-9]+$') then
    raise exception 'No. KK harus 16 digit angka';
  end if;
  new.rt := '04'; new.rw := '01';
  return new;
end; $$;

drop trigger if exists trg_validate_rt_warga on public.warga;
create trigger trg_validate_rt_warga before insert or update on public.warga for each row execute function public.validate_rt_warga();

create or replace function public.validate_rt_kk()
returns trigger language plpgsql as $$
begin
  if length(new.no_kk) <> 16 or new.no_kk !~ '^[0-9]+$' then
    raise exception 'No. KK harus 16 digit angka';
  end if;
  new.rt := '04'; new.rw := '01';
  return new;
end; $$;

drop trigger if exists trg_validate_rt_kk on public.kartu_keluarga;
create trigger trg_validate_rt_kk before insert or update on public.kartu_keluarga for each row execute function public.validate_rt_kk();

-- Quick verification.
select 'profiles' as table_name, count(*) as total from public.profiles
union all select 'kartu_keluarga', count(*) from public.kartu_keluarga
union all select 'warga', count(*) from public.warga;
