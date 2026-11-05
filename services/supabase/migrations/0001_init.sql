-- HomeDesigner — initial schema (ADR-004, ADR-011, docs/DATA_MODEL.md §4)
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to re-run: uses IF NOT EXISTS / OR REPLACE.
-- STATUS: written against the Supabase/Postgres docs but NOT yet executed against a real project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  scene          jsonb not null,
  schema_version integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A normal home is well under 1 MB (NFR-04); refuse anything absurd.
  constraint projects_scene_size check (pg_column_size(scene) < 4000000)
);
create index if not exists projects_owner_idx on public.projects (owner_id, updated_at desc);

create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index if not exists shares_project_idx on public.shares (project_id);

-- Written ONLY by trusted server code (billing webhooks / ad verification), never by the browser.
create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  provider           text not null check (provider in ('stripe', 'revenuecat')),
  status             text not null,
  plan               text,
  current_period_end timestamptz,
  updated_at         timestamptz not null default now()
);

create table if not exists public.unlocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  asset_id   text not null,
  source     text not null check (source in ('rewarded_ad', 'purchase')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists unlocks_user_idx on public.unlocks (user_id);

-- ---------------------------------------------------------------- keep updated_at honest
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row level security
alter table public.projects      enable row level security;
alter table public.shares        enable row level security;
alter table public.subscriptions enable row level security;
alter table public.unlocks       enable row level security;

-- Projects: the owner can do everything with their own rows, nobody else can see them.
drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Shares: managed by the owner of the project they point at.
drop policy if exists shares_owner_all on public.shares;
create policy shares_owner_all on public.shares
  for all to authenticated
  using (exists (select 1 from public.projects p where p.id = shares.project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = shares.project_id and p.owner_id = auth.uid()));

-- Subscriptions / unlocks: users may READ their own; there is deliberately NO insert/update policy, so only the
-- service role (edge functions, webhooks) can write them. A browser can never grant itself access.
drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions for select to authenticated using (user_id = auth.uid());

drop policy if exists unlocks_read_own on public.unlocks;
create policy unlocks_read_own on public.unlocks for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- public read of a shared home
-- Anonymous visitors cannot read `projects`; they can only call this function with a valid, non-revoked token.
create or replace function public.get_shared_project(p_token text) returns jsonb
language sql security definer set search_path = public stable as $$
  select p.scene
  from public.shares s
  join public.projects p on p.id = s.project_id
  where s.token = p_token and s.revoked_at is null
  limit 1
$$;
revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;
