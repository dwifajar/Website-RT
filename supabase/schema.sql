-- Dusun Dawung RT 04 / RW 01
-- Supabase / PostgreSQL production schema
create extension if not exists pgcrypto;

create type public.user_role as enum ('warga','admin','ketua_rt');
create type public.record_status as enum ('aktif','nonaktif');
create type public.surat_status as enum ('menunggu','diproses','selesai','ditolak');
create type public.aspirasi_status as enum ('baru','diproses','selesai');
create type public.transaksi_jenis as enum ('pemasukan','pengeluaran');

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
  created_at timestamptz not null default now()
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

create table if not exists public.surat_pengajuan (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid references public.warga(id) on delete set null,
  pemohon_nama text not null,
  jenis text not null,
  status public.surat_status not null default 'menunggu',
  catatan text,
  nomor_surat text,
  dokumen_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  tanggal date not null,
  jam text,
  lokasi text,
  deskripsi text,
  created_at timestamptz not null default now()
);

create table if not exists public.pengumuman (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.transaksi_keuangan (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  jenis public.transaksi_jenis not null,
  kategori text not null,
  nominal numeric(16,2) not null check (nominal >= 0),
  keterangan text,
  bukti_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.aspirasi (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid references public.warga(id) on delete set null,
  nama text not null,
  judul text not null,
  isi text not null,
  status public.aspirasi_status not null default 'baru',
  tanggapan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifikasi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  judul text not null,
  isi text not null,
  dibaca boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Public read policies
alter table public.agenda enable row level security;
alter table public.pengumuman enable row level security;
alter table public.transaksi_keuangan enable row level security;
alter table public.profiles enable row level security;
alter table public.warga enable row level security;
alter table public.kartu_keluarga enable row level security;
alter table public.surat_pengajuan enable row level security;
alter table public.aspirasi enable row level security;
alter table public.notifikasi enable row level security;
alter table public.audit_logs enable row level security;

create policy "public read agenda" on public.agenda for select using (true);
create policy "public read pengumuman" on public.pengumuman for select using (true);
create policy "public read kas" on public.transaksi_keuangan for select using (true);

-- Authenticated user can read own profile.
create policy "own profile read" on public.profiles for select
using (auth.uid() = id);

-- Warga can read/update their own profile.
create policy "own profile update" on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Warga can see their own service submissions.
create policy "own surat read" on public.surat_pengajuan for select
using (
  warga_id in (select w.id from public.warga w where w.profile_id = auth.uid())
);

create policy "own surat insert" on public.surat_pengajuan for insert
with check (
  warga_id in (select w.id from public.warga w where w.profile_id = auth.uid())
);

-- Warga can create/read own aspirations.
create policy "own aspirasi read" on public.aspirasi for select
using (
  warga_id in (select w.id from public.warga w where w.profile_id = auth.uid())
);

create policy "own aspirasi insert" on public.aspirasi for insert
with check (
  warga_id in (select w.id from public.warga w where w.profile_id = auth.uid())
);

-- Admin / Ketua RT helper function.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin','ketua_rt')
  );
$$;

-- Admin full access policies.
create policy "admin manage warga" on public.warga for all
using (public.is_admin()) with check (public.is_admin());

create policy "admin manage kk" on public.kartu_keluarga for all
using (public.is_admin()) with check (public.is_admin());

create policy "admin manage surat" on public.surat_pengajuan for all
using (public.is_admin()) with check (public.is_admin());

create policy "admin manage agenda" on public.agenda for all
using (public.is_admin()) with check (public.is_admin());

create policy "admin manage pengumuman" on public.pengumuman for all
using (public.is_admin()) with check (public.is_admin());

create policy "admin manage keuangan" on public.transaksi_keuangan for all
using (public.is_admin()) with check (public.is_admin());

create policy "admin manage aspirasi" on public.aspirasi for all
using (public.is_admin()) with check (public.is_admin());

create policy "own notifications" on public.notifikasi for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Useful view for dashboard.
create or replace view public.v_saldo_kas as
select
  coalesce(sum(case when jenis='pemasukan' then nominal else 0 end),0) as pemasukan,
  coalesce(sum(case when jenis='pengeluaran' then nominal else 0 end),0) as pengeluaran,
  coalesce(sum(case when jenis='pemasukan' then nominal else -nominal end),0) as saldo
from public.transaksi_keuangan;
