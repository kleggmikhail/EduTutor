-- EduTutor: схема Этапа 0
-- Выполнить в Supabase: SQL Editor → New query → вставить → Run

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'ru',
  api_key_encrypted text,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "own settings select"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "own settings insert"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "own settings update"
  on public.user_settings for update
  using (auth.uid() = user_id);
