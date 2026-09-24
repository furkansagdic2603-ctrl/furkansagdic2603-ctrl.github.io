-- Supabase SQL Editor'da bir kez çalıştırın: mevcut ve yeni yorumları anında yayımlar.
alter table public.site_comments alter column approved set default true;
update public.site_comments set approved = true where approved = false;
drop policy if exists "read approved comments" on public.site_comments;
create policy "read approved comments" on public.site_comments for select to anon using (true);
drop policy if exists "submit pending comments" on public.site_comments;
create policy "submit pending comments" on public.site_comments for insert to anon with check (approved = true);
