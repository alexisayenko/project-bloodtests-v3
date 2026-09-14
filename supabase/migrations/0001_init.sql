-- supabase/migrations/0001_init.sql
--
-- project-bloodtests-v3 — init, self-hosted Supabase on perkunas (LXC, own
-- instance, independent from Cairn's LXC 103).
--
-- Scope: one table, user_backups (1). Postgres mirror of the shape the app's
-- Firebase cutover already uses at Firestore users/{uid} (see CLAUDE.md's
-- Account section: manifest / labReports / medications / scheduledVisits /
-- settings as native fields on one per-person document) — kept here as the
-- equivalent one-row-per-user backup blob rather than normalized tables,
-- since the source of truth for shape stays the app's own backup bundle
-- (data/backupArchive.ts), not this schema.
--
-- Auth: Supabase Auth (auth.users) is provided by the platform, this
-- instance's own GoTrue, config'd for Google + Apple OAuth only (no
-- email/password, no phone). id below IS the auth.users id — a user has
-- at most one backup row, upserted in place.
--
-- Conventions (mirrors project-travel's supabase/migrations house style):
--   - gen_random_uuid() available via pgcrypto, not needed here since the PK
--     is supplied by auth (no surrogate id to generate).
--   - timestamptz default now() for updated_at.
--   - set_updated_at() trigger defined once, applied to the mutable table.
--     Redefined fresh in this instance (separate Postgres database from
--     project-travel's — nothing is shared across instances).
--   - RLS on, all CRUD gated on id = auth.uid().
--
-- Why this table needs no service-role/broad-read carve-out
-- (project-travel's own documented gap — RLS enabled with zero policies
-- silently rejecting reads — doesn't apply here, and neither does its fix):
--   project-travel's city/place are shared reference data: no owner column,
--   meant to be readable by every authenticated user, so they needed RLS
--   *disabled* and an explicit `grant select ... to authenticated` instead
--   (see 20260521120000_disable_rls_on_reference_tables.sql there — RLS on
--   with no policy silently rejects every row, including for the owner).
--   user_backups has the opposite shape: every row is single-user-owned by
--   construction (id is the owning user's own auth.users id, not a foreign
--   key to some separate owner column elsewhere), nothing in the app reads
--   another user's backup, and there is no unauthenticated or cross-user
--   read path to carve out. A plain `id = auth.uid()` policy on all four
--   operations is therefore complete on its own — there is no reference-data
--   case here for a broader grant to paper over.

create extension if not exists pgcrypto;

-- Shared updated-at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_backups : one row per user, the whole app backup bundle as jsonb
-- ---------------------------------------------------------------------------
create table public.user_backups (
  id                uuid        primary key references auth.users(id) on delete cascade,
  manifest          jsonb,
  lab_reports       jsonb,
  medications       jsonb,
  scheduled_visits  jsonb,
  settings          jsonb,
  updated_at        timestamptz not null default now()
);

create trigger user_backups_set_updated_at
  before update on public.user_backups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants & RLS
-- ---------------------------------------------------------------------------

alter table public.user_backups enable row level security;

create policy user_backups_select_own on public.user_backups
  for select to authenticated
  using (id = auth.uid());

create policy user_backups_insert_own on public.user_backups
  for insert to authenticated
  with check (id = auth.uid());

create policy user_backups_update_own on public.user_backups
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy user_backups_delete_own on public.user_backups
  for delete to authenticated
  using (id = auth.uid());

grant select, insert, update, delete on public.user_backups to authenticated;
