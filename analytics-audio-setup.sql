-- Run once in the Supabase SQL Editor for page-view counts.
create table if not exists public.site_page_views (
  id bigint generated always as identity primary key,
  page_path text not null check (length(page_path) between 1 and 240 and page_path ~ '^/[a-z0-9/-]*$'),
  created_at timestamptz not null default now()
);
create index if not exists site_page_views_date_idx on public.site_page_views (created_at desc);
create index if not exists site_page_views_path_idx on public.site_page_views (page_path, created_at desc);
alter table public.site_page_views enable row level security;
revoke all on public.site_page_views from anon, authenticated;
grant insert (page_path) on public.site_page_views to anon;
grant select on public.site_page_views to service_role;
drop policy if exists "record public page view" on public.site_page_views;
create policy "record public page view" on public.site_page_views
  for insert to anon with check (page_path <> '/admin/' and page_path !~ '^/admin/');
