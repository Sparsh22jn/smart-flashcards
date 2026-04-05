-- Smart FlashCards — Database Schema
-- Supabase (PostgreSQL) with Row-Level Security

-- ── Extensions ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Decks ────────────────────────────────────────────────────────────
create table public.decks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  source text,                    -- original input (topic, URL, filename)
  source_type text default 'topic', -- topic, youtube, pdf, document, image, paste
  card_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.decks enable row level security;
create policy "Users can CRUD own decks" on public.decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_decks_user on public.decks(user_id);

-- ── Cards ────────────────────────────────────────────────────────────
create table public.cards (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid references public.decks(id) on delete cascade not null,
  front text not null,             -- question
  back text not null,              -- answer
  explanation text,                -- ELI5 explanation
  mnemonic text,                   -- memory trick
  difficulty text default 'medium', -- easy, medium, hard
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cards enable row level security;
create policy "Users can CRUD own cards" on public.cards
  for all using (
    deck_id in (select id from public.decks where user_id = auth.uid())
  ) with check (
    deck_id in (select id from public.decks where user_id = auth.uid())
  );

create index idx_cards_deck on public.cards(deck_id);

-- ── Card Progress (Spaced Repetition) ────────────────────────────────
create table public.card_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade not null,
  ease_factor real default 2.5,
  interval_days integer default 0,
  repetitions integer default 0,
  next_review timestamptz default now(),
  last_reviewed timestamptz,
  created_at timestamptz default now(),
  unique(user_id, card_id)
);

alter table public.card_progress enable row level security;
create policy "Users can CRUD own progress" on public.card_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_progress_user_due on public.card_progress(user_id, next_review);

-- ── Study Sessions ───────────────────────────────────────────────────
create table public.study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  deck_id uuid references public.decks(id) on delete set null,
  cards_studied integer default 0,
  correct_count integer default 0,
  duration_seconds integer default 0,
  created_at timestamptz default now()
);

alter table public.study_sessions enable row level security;
create policy "Users can CRUD own sessions" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_sessions_user on public.study_sessions(user_id);

-- ── Cost Tracker ─────────────────────────────────────────────────────
create table public.cost_tracker (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  total_input_tokens bigint default 0,
  total_output_tokens bigint default 0,
  total_cost real default 0,
  monthly_limit real default 25.0,
  updated_at timestamptz default now()
);

alter table public.cost_tracker enable row level security;
create policy "Users can CRUD own cost tracker" on public.cost_tracker
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── User Preferences ─────────────────────────────────────────────────
create table public.user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value jsonb default '{}',
  unique(user_id, key)
);

alter table public.user_preferences enable row level security;
create policy "Users can CRUD own preferences" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Functions ────────────────────────────────────────────────────────

-- Update deck card count
create or replace function public.update_deck_card_count(deck_id_input uuid)
returns void as $$
begin
  update public.decks
  set card_count = (select count(*) from public.cards where deck_id = deck_id_input),
      updated_at = now()
  where id = deck_id_input;
end;
$$ language plpgsql security definer;

-- Increment cost tracker
create or replace function public.increment_cost(
  user_id_input uuid,
  input_tokens_add bigint,
  output_tokens_add bigint,
  cost_add real
) returns void as $$
begin
  insert into public.cost_tracker (user_id, total_input_tokens, total_output_tokens, total_cost)
  values (user_id_input, input_tokens_add, output_tokens_add, cost_add)
  on conflict (user_id)
  do update set
    total_input_tokens = cost_tracker.total_input_tokens + input_tokens_add,
    total_output_tokens = cost_tracker.total_output_tokens + output_tokens_add,
    total_cost = cost_tracker.total_cost + cost_add,
    updated_at = now();
end;
$$ language plpgsql security definer;
