-- Rock Werchter Planner — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- Shared lineup cache (replaces data/lineup.json in production)
create table if not exists public.lineup_cache (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Per-user artist selections, keyed by Spotify user id
create table if not exists public.user_selections (
  spotify_user_id text primary key,
  display_name text not null default '',
  artist_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lock both tables down: the app only talks to Supabase server-side with the
-- service role key (which bypasses RLS). No anon/authenticated access needed.
alter table public.lineup_cache enable row level security;
alter table public.user_selections enable row level security;
