-- Migration 2: multi-event support
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- Events: each festival/concert with its own timetable
create table if not exists public.events (
  slug text primary key,
  name text not null,
  location text not null default '',
  start_date date,
  end_date date,
  image_url text,
  source_url text,
  source_type text not null default 'ai_url', -- builtin | ai_url | ai_screenshot | ai_search
  created_by text not null default '',        -- spotify user id
  lineup jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- Selections become per event
alter table public.user_selections
  add column if not exists event_slug text not null default 'rock-werchter-2026';

alter table public.user_selections drop constraint if exists user_selections_pkey;
alter table public.user_selections add primary key (spotify_user_id, event_slug);
