-- Supabase SQL Editor'da bir kez çalıştırın. Onay için approved alanını true yapın.
create table if not exists public.site_comments (
  id bigint generated always as identity primary key,
  page_path text not null check (length(page_path) between 2 and 240 and page_path ~ '^/[a-z0-9/-]+/$'),
  first_name text not null check (length(btrim(first_name)) between 1 and 60),
  last_name text not null check (length(btrim(last_name)) between 1 and 60),
  body text not null check (length(btrim(body)) between 1 and 2000),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists site_comments_page_idx on public.site_comments (page_path, created_at) where approved;
alter table public.site_comments enable row level security;
revoke all on public.site_comments from anon, authenticated;
grant select (first_name, last_name, body, created_at, page_path) on public.site_comments to anon;
grant insert (page_path, first_name, last_name, body) on public.site_comments to anon;
drop policy if exists "read approved comments" on public.site_comments;
create policy "read approved comments" on public.site_comments for select to anon using (approved = true);
drop policy if exists "submit pending comments" on public.site_comments;
create policy "submit pending comments" on public.site_comments for insert to anon with check (approved = false);
