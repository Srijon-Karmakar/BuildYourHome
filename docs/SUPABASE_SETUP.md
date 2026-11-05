# Connecting a real Supabase project

Without any setup the app runs on the **demo backend** (`LocalBackend`): accounts, saved homes, share links, the demo
subscription and ad unlocks are stored in the browser only. That is enough to build and test every flow, but nothing syncs
between devices and it is not secure.

To use real accounts and cloud storage:

1. Create a free project at <https://supabase.com> (ADR-012: free tier is enough for the demo).
2. Open **SQL editor**, paste [`services/supabase/migrations/0001_init.sql`](../services/supabase/migrations/0001_init.sql) and run it.
   It creates `projects`, `shares`, `subscriptions`, `unlocks`, turns on row-level security and adds the public
   `get_shared_project(token)` function.
3. **Project settings → API Keys**: copy the **Publishable key** (`sb_publishable_…`; older dashboards call it the *anon public* key).
   The project URL is under the green **Connect** button / Settings → General.
   **Never** put the **Secret key** (`sb_secret_…`, formerly `service_role`) in the app, in `.env.local` or in git.
4. Create `apps/web/.env.local` (git-ignored) from `apps/web/.env.example`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...   # the publishable key (variable keeps its old name)
   ```
4b. Also run [`0002_delete_account.sql`](../services/supabase/migrations/0002_delete_account.sql) (adds `delete_my_account()`,
   needed for the app's "Delete my account" button; it cascades to the user's homes, links, subscription and unlocks).
4c. **Authentication → URL Configuration**: set **Site URL** to where the app runs (e.g. `http://localhost:5173` while developing,
   your real domain later) and add the same address under **Redirect URLs**. Password-reset emails link back to it.
5. **Authentication → Providers**: email is on by default. For a quick demo you may turn off *Confirm email*;
   otherwise users must open the confirmation link before they can sign in (the app tells them so).
6. Restart `pnpm dev`. The Account menu no longer says "Demo mode".

## What is verified and what is not

| Part | Status |
|---|---|
| Backend interface, entitlement rules, `LocalBackend`, all UI flows | Unit + browser tested |
| `SupabaseBackend` code | Type-checked; **not yet run against a live project** |
| `0001_init.sql` | Reviewed; **not yet executed** |
| Rewarded-ad unlocks and subscriptions on Supabase | **Deliberately read-only from the browser** (see below) |

First thing to do after step 6: sign up, save a home, create a share link and open it in a private window.

## Security model (why entitlements can't be faked)

* `projects` / `shares`: row-level security — only the owner reads or writes them.
* `subscriptions` / `unlocks`: users may only **read** their own rows. There is no insert/update policy, so only trusted
  server code using the service role can write them. A modified browser cannot grant itself premium access.
* Shared homes: anonymous visitors cannot read `projects`. They call `get_shared_project(token)`, which returns the scene
  only for a valid, non-revoked token (18 random bytes). Revoking sets `revoked_at`.

## Still to build for real monetisation (Phase 4 / later)

* **Subscriptions:** Stripe (web) and RevenueCat (stores) webhooks → an edge function that upserts `subscriptions`.
* **Rewarded ads:** an ad network with server-side verification callbacks → an edge function that inserts into `unlocks`.
  Until then the Supabase backend refuses `unlockWithAd` / `setSubscription` instead of pretending.
* **Real ad slots** (AdMob / web ads) behind the same `AdBanner` / rewarded flow; today they are labelled demo placeholders.
