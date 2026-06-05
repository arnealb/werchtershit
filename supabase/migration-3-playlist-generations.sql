-- Migration 3: playlist generation history
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

create table if not exists public.playlist_generations (
  id bigint generated always as identity primary key,
  playlist_id text not null,
  spotify_user_id text not null,
  event_slug text not null default '',
  event_name text not null default '',
  mode text not null default 'smart',           -- smart | quick
  tracks_per_artist int not null default 5,
  artist_names jsonb not null default '[]'::jsonb,
  added_tracks int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists playlist_generations_user_idx
  on public.playlist_generations (spotify_user_id, created_at desc);

alter table public.playlist_generations enable row level security;
