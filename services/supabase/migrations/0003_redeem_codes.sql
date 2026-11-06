-- PlotFramer — redeem codes: a valid code unlocks every asset and turns ads off for the account that redeems it.
-- Run in the Supabase SQL editor after 0001 / 0002.
--
-- Why this is safe
--   * Codes are stored only as SHA-256 hashes, in tables with RLS enabled and NO policies, so the browser can never
--     read them. The only way in is the `redeem_code` function below.
--   * The function writes `subscriptions` as a security-definer function, so users still can't write that table.
--   * Wrong guesses are throttled (10 failures per hour per account).
--   * Codes are case/space/dash insensitive: 'ab-12 cd' == 'AB12CD'.

-- 'code' = granted by redeeming a code (not by Stripe / RevenueCat).
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('stripe', 'revenuecat', 'code'));

create table if not exists public.redeem_codes (
  code_hash   text primary key,
  label       text not null default '',
  max_uses    int,                      -- null = unlimited
  uses        int  not null default 0,
  grant_days  int,                      -- null = unlocked for as long as the account exists
  expires_at  timestamptz,              -- the code itself stops working after this
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.redemptions (
  code_hash   text not null references public.redeem_codes (code_hash) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code_hash, user_id)
);

create table if not exists public.redeem_failures (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists redeem_failures_user_at on public.redeem_failures (user_id, at desc);

-- RLS on, no policies: invisible to the browser.
alter table public.redeem_codes    enable row level security;
alter table public.redemptions     enable row level security;
alter table public.redeem_failures enable row level security;

create or replace function public.redeem_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  norm  text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  h     text := encode(sha256(convert_to(norm, 'utf8')), 'hex');
  rc    public.redeem_codes%rowtype;
  until timestamptz;
begin
  if uid is null then return 'invalid'; end if;

  if (select count(*) from public.redeem_failures where user_id = uid and at > now() - interval '1 hour') >= 10 then
    return 'throttled';
  end if;

  select * into rc from public.redeem_codes where code_hash = h and not revoked for update;
  if not found then
    insert into public.redeem_failures (user_id) values (uid);
    return 'invalid';
  end if;
  if rc.expires_at is not null and rc.expires_at < now() then return 'expired'; end if;

  -- Redeeming the same code again on the same account is a harmless no-op.
  if not exists (select 1 from public.redemptions where code_hash = h and user_id = uid) then
    if rc.max_uses is not null and rc.uses >= rc.max_uses then return 'used_up'; end if;
    insert into public.redemptions (code_hash, user_id) values (h, uid);
    update public.redeem_codes set uses = uses + 1 where code_hash = h;
  end if;

  until := case when rc.grant_days is null then null else now() + make_interval(days => rc.grant_days) end;

  -- Never overwrite a real paid subscription: only replace our own gift row or a lapsed/cancelled one.
  insert into public.subscriptions (user_id, provider, status, plan, current_period_end)
  values (uid, 'code', 'active', 'gift', until)
  on conflict (user_id) do update
    set provider = 'code', status = 'active', plan = 'gift', current_period_end = excluded.current_period_end, updated_at = now()
    where public.subscriptions.provider = 'code'
       or public.subscriptions.status not in ('active', 'trialing')
       or (public.subscriptions.current_period_end is not null and public.subscriptions.current_period_end < now());

  return 'ok';
end;
$$;

revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- CREATE a code (run in the SQL editor; pick your own secret text, keep it long and random):
--
--   insert into public.redeem_codes (code_hash, label, max_uses)
--   values (encode(sha256(convert_to(upper(regexp_replace('MY-SECRET-CODE-2026', '[^A-Za-z0-9]', '', 'g')), 'utf8')), 'hex'),
--           'owner', 1);
--
--   -- optional columns: grant_days (e.g. 30 = unlock for a month), expires_at (stop accepting the code after this date).
--   -- max_uses null = unlimited.
--
-- REVOKE a code (accounts that already redeemed keep their unlock):
--   update public.redeem_codes set revoked = true
--   where code_hash = encode(sha256(convert_to(upper(regexp_replace('MY-SECRET-CODE-2026', '[^A-Za-z0-9]', '', 'g')), 'utf8')), 'hex');
--
-- Take the unlock away from one account:
--   delete from public.subscriptions
--   where provider = 'code' and user_id = (select id from auth.users where email = 'someone@example.com');
-- ---------------------------------------------------------------------------------------------------------
