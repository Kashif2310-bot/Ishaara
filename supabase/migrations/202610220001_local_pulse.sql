-- Kalaburagi pulse: public posts from the city's news channels, collected by the
-- local-pulse Edge Function (service role) and read by the brief page (anon, read-only).
--
-- Everything stored here is already public on YouTube or Instagram. The browser may read it;
-- only the Edge Function may write it (the service role bypasses RLS; no insert, update or
-- delete policy exists for anon or authenticated users).

create table if not exists public.pulse_items (
  key text primary key,
  platform text not null check (platform in ('youtube', 'instagram')),
  channel text not null,
  channel_name text not null,
  kind text not null check (kind in ('video', 'short', 'reel', 'post')),
  item_id text not null,
  url text not null check (url like 'https://%'),
  title text not null default '',
  body text not null default '',
  published_at timestamptz,
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  fetched_at timestamptz not null,
  first_seen_at timestamptz not null default now()
);

create index if not exists pulse_items_published_idx on public.pulse_items (published_at desc);
create index if not exists pulse_items_channel_idx on public.pulse_items (platform, channel, published_at desc);

-- One row per item per collection run, so the page can show what is rising right now.
create table if not exists public.pulse_item_stats (
  key text not null references public.pulse_items (key) on delete cascade,
  captured_at timestamptz not null,
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  primary key (key, captured_at)
);

create index if not exists pulse_item_stats_time_idx on public.pulse_item_stats (captured_at desc);

-- Each source's outcome per run, so the page can say how fresh the data is and what failed.
create table if not exists public.pulse_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('youtube', 'instagram')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  ok boolean not null,
  items integer not null default 0 check (items >= 0),
  message text
);

create index if not exists pulse_runs_time_idx on public.pulse_runs (finished_at desc);

alter table public.pulse_items enable row level security;
alter table public.pulse_item_stats enable row level security;
alter table public.pulse_runs enable row level security;

create policy pulse_items_public_read on public.pulse_items
  for select to anon, authenticated using (true);

create policy pulse_item_stats_public_read on public.pulse_item_stats
  for select to anon, authenticated using (true);

create policy pulse_runs_public_read on public.pulse_runs
  for select to anon, authenticated using (true);

-- No insert/update/delete policies: writes come only from the Edge Function's service role.
