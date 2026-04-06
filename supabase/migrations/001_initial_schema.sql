-- Smart FlashCards — Complete Database Schema
-- Supabase (PostgreSQL) with Row-Level Security
-- 14 tables, triggers, functions, and indexes

-- ── Extensions ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ══════════════════════════════════════════════════════════════════════

-- ── User Profiles ───────────────────────────────────────────────────
-- Extended profile data beyond auth.users (display name, avatar, goals)
create table public.user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text,
  avatar_url text,
  bio text,
  timezone text default 'UTC' not null,
  daily_goal_cards integer default 20 not null,
  daily_goal_minutes integer default 15 not null,
  preferred_language text default 'en' not null,
  onboarding_completed boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.user_profiles enable row level security;
create policy "Users can CRUD own profile" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Folders ─────────────────────────────────────────────────────────
-- Hierarchical organization for decks
create table public.folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  position integer default 0 not null,
  emoji text,
  created_at timestamptz default now() not null
);

alter table public.folders enable row level security;
create policy "Users can CRUD own folders" on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_folders_parent on public.folders(user_id, parent_id);

-- ── Decks ────────────────────────────────────────────────────────────
create table public.decks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  source text,                          -- original input (topic, URL, filename)
  source_type text default 'topic',     -- topic, youtube, pdf, document, image, paste
  card_count integer default 0,
  -- Organization
  folder_id uuid references public.folders(id) on delete set null,
  emoji text,
  color text,                           -- user-chosen accent hex color
  language text default 'en',
  -- Sharing & public library
  is_public boolean default false not null,
  share_token text,                     -- unique short token for shareable link
  is_archived boolean default false not null,
  clone_count integer default 0 not null,
  rating_sum integer default 0 not null,
  rating_count integer default 0 not null,
  original_deck_id uuid references public.decks(id) on delete set null,
  -- Study stats (denormalized for fast display)
  last_studied_at timestamptz,
  total_study_time_seconds integer default 0 not null,
  -- FSRS per-deck settings
  new_cards_per_day integer default 20 not null,
  review_cards_per_day integer default 200 not null,
  desired_retention real default 0.9 not null,
  fsrs_weights jsonb,                   -- 17-element FSRS-5 weight array
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.decks enable row level security;
create policy "Users can CRUD own decks" on public.decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Anyone can read public decks" on public.decks
  for select using (is_public = true);

create index idx_decks_user on public.decks(user_id);
create index idx_decks_folder on public.decks(user_id, folder_id);
create index idx_decks_last_studied on public.decks(user_id, last_studied_at desc nulls last);
create unique index idx_decks_share_token on public.decks(share_token) where share_token is not null;
create index idx_decks_public on public.decks(is_public) where is_public = true;

-- ── Tags ─────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

alter table public.tags enable row level security;
create policy "Users can CRUD own tags" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_tags_user on public.tags(user_id, name);

-- ── Deck Tags (many-to-many) ────────────────────────────────────────
create table public.deck_tags (
  deck_id uuid references public.decks(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (deck_id, tag_id)
);

alter table public.deck_tags enable row level security;
create policy "Users can CRUD own deck tags" on public.deck_tags
  for all using (
    deck_id in (select id from public.decks where user_id = auth.uid())
  ) with check (
    deck_id in (select id from public.decks where user_id = auth.uid())
  );

-- ── Cards ────────────────────────────────────────────────────────────
create table public.cards (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid references public.decks(id) on delete cascade not null,
  front text not null,                  -- question
  back text not null,                   -- answer
  explanation text,                     -- ELI5 explanation
  mnemonic text,                        -- memory trick
  difficulty text default 'medium',     -- easy, medium, hard
  position integer default 0,
  -- Card types & rich content
  card_type text default 'basic' not null, -- basic, cloze, mcq, typed_answer
  front_rich jsonb,                     -- rich content (markdown, images, audio)
  back_rich jsonb,
  cloze_text text,                      -- for cloze: "The {{c1::answer}} is here"
  mcq_options jsonb,                    -- for MCQ: [{text, isCorrect}]
  extra text,                           -- additional notes (Anki compat)
  source_highlight text,                -- text span from source this card was generated from
  -- Media
  image_url text,
  audio_url text,
  -- Study flags
  is_suspended boolean default false not null,
  is_buried boolean default false not null,
  flags integer default 0 not null,     -- bitfield: 1=red, 2=orange, 4=green, 8=blue
  -- Timestamps
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
create policy "Anyone can read cards in public decks" on public.cards
  for select using (
    deck_id in (select id from public.decks where is_public = true)
  );

create index idx_cards_deck on public.cards(deck_id);
create index idx_cards_deck_type on public.cards(deck_id, card_type);
create index idx_cards_active on public.cards(deck_id) where is_suspended = false;
create index idx_cards_search on public.cards using gin(
  to_tsvector('english', coalesce(front, '') || ' ' || coalesce(back, ''))
);

-- ── Card Tags (many-to-many) ────────────────────────────────────────
create table public.card_tags (
  card_id uuid references public.cards(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (card_id, tag_id)
);

alter table public.card_tags enable row level security;
create policy "Users can CRUD own card tags" on public.card_tags
  for all using (
    card_id in (
      select c.id from public.cards c
      join public.decks d on d.id = c.deck_id
      where d.user_id = auth.uid()
    )
  ) with check (
    card_id in (
      select c.id from public.cards c
      join public.decks d on d.id = c.deck_id
      where d.user_id = auth.uid()
    )
  );

-- ── Card Media ──────────────────────────────────────────────────────
-- Multiple media attachments per card (images, audio, video)
create table public.card_media (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid references public.cards(id) on delete cascade not null,
  media_type text not null,             -- image, audio, video
  storage_path text not null,           -- path in Supabase Storage
  url text not null,                    -- public/signed URL
  filename text,
  mime_type text,
  size_bytes integer,
  position integer default 0 not null,
  side text default 'front' not null,   -- front or back
  occlusion_data jsonb,                 -- for image occlusion: [{x, y, width, height}]
  created_at timestamptz default now() not null
);

alter table public.card_media enable row level security;
create policy "Users can CRUD own card media" on public.card_media
  for all using (
    card_id in (
      select c.id from public.cards c
      join public.decks d on d.id = c.deck_id
      where d.user_id = auth.uid()
    )
  ) with check (
    card_id in (
      select c.id from public.cards c
      join public.decks d on d.id = c.deck_id
      where d.user_id = auth.uid()
    )
  );

create index idx_card_media_card on public.card_media(card_id, position);

-- ══════════════════════════════════════════════════════════════════════
-- SPACED REPETITION & STUDY
-- ══════════════════════════════════════════════════════════════════════

-- ── Card Progress ───────────────────────────────────────────────────
-- Tracks FSRS state per user per card
create table public.card_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade not null,
  -- SM-2 fields (backward compat)
  ease_factor real default 2.5,
  interval_days integer default 0,
  repetitions integer default 0,
  next_review timestamptz default now(),
  last_reviewed timestamptz,
  -- FSRS-5 fields
  stability real,                       -- memory stability in days
  difficulty real,                      -- intrinsic difficulty (0.0-1.0)
  state smallint default 0 not null,    -- 0=New, 1=Learning, 2=Review, 3=Relearning
  elapsed_days integer default 0 not null,
  scheduled_days integer default 0 not null,
  reps integer default 0 not null,      -- total reviews
  lapses integer default 0 not null,    -- times forgotten (rated Again in Review)
  last_rating smallint,                 -- most recent rating (1-4)
  -- Flags
  is_leech boolean default false not null,
  is_bookmarked boolean default false not null,
  -- Timestamps
  created_at timestamptz default now(),
  unique(user_id, card_id)
);

alter table public.card_progress enable row level security;
create policy "Users can CRUD own progress" on public.card_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_progress_user_due on public.card_progress(user_id, next_review);
create index idx_progress_state on public.card_progress(user_id, state);
create index idx_progress_leech on public.card_progress(user_id) where is_leech = true;

-- ── Review Log ──────────────────────────────────────────────────────
-- Immutable append-only log of every card review (critical for FSRS optimization)
create table public.review_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade not null,
  deck_id uuid references public.decks(id) on delete set null,
  session_id uuid,                      -- FK added after study_sessions is created
  -- Rating
  rating smallint not null,             -- 1=Again, 2=Hard, 3=Good, 4=Easy
  -- State transitions
  state_before smallint not null,       -- card state before review
  state_after smallint not null,        -- card state after review
  -- FSRS snapshots
  stability_before real,
  stability_after real,
  difficulty_before real,
  difficulty_after real,
  -- Interval data
  ease_factor_before real,
  interval_before_days integer,
  interval_after_days integer,
  elapsed_days integer,
  -- Timing
  time_spent_ms integer,                -- milliseconds on this card before rating
  reviewed_at timestamptz default now() not null
);

alter table public.review_log enable row level security;
create policy "Users can read own review logs" on public.review_log
  for select using (auth.uid() = user_id);
create policy "Users can insert own review logs" on public.review_log
  for insert with check (auth.uid() = user_id);
-- No update or delete — immutable log

create index idx_review_log_user_card on public.review_log(user_id, card_id, reviewed_at desc);
create index idx_review_log_user_date on public.review_log(user_id, reviewed_at desc);
create index idx_review_log_session on public.review_log(session_id);
create index idx_review_log_deck on public.review_log(user_id, deck_id, reviewed_at desc);

-- ── Study Sessions ──────────────────────────────────────────────────
create table public.study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  deck_id uuid references public.decks(id) on delete set null,
  cards_studied integer default 0,
  correct_count integer default 0,
  duration_seconds integer default 0,
  -- Detailed breakdown
  new_count integer default 0 not null,
  review_count integer default 0 not null,
  relearn_count integer default 0 not null,
  again_count integer default 0 not null,
  hard_count integer default 0 not null,
  good_count integer default 0 not null,
  easy_count integer default 0 not null,
  average_time_per_card_ms integer,
  mode text default 'normal' not null,  -- normal, cram, custom, due_only
  -- Timestamps
  created_at timestamptz default now(),
  ended_at timestamptz
);

alter table public.study_sessions enable row level security;
create policy "Users can CRUD own sessions" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_sessions_user on public.study_sessions(user_id);
create index idx_sessions_user_deck on public.study_sessions(user_id, deck_id, created_at desc);

-- Add FK from review_log to study_sessions (now that it exists)
alter table public.review_log
  add constraint fk_review_log_session
  foreign key (session_id) references public.study_sessions(id) on delete set null;

-- ══════════════════════════════════════════════════════════════════════
-- GAMIFICATION & TRACKING
-- ══════════════════════════════════════════════════════════════════════

-- ── Streaks ─────────────────────────────────────────────────────────
create table public.streaks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  current_streak integer default 0 not null,
  longest_streak integer default 0 not null,
  last_study_date date,
  streak_start_date date,
  freeze_count integer default 0 not null,
  total_study_days integer default 0 not null,
  updated_at timestamptz default now() not null
);

alter table public.streaks enable row level security;
create policy "Users can CRUD own streak" on public.streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Achievements ────────────────────────────────────────────────────
create table public.achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  achievement_key text not null,        -- first_deck, 100_reviews, 7_day_streak, etc.
  unlocked_at timestamptz default now() not null,
  metadata jsonb default '{}',
  unique(user_id, achievement_key)
);

alter table public.achievements enable row level security;
create policy "Users can read own achievements" on public.achievements
  for select using (auth.uid() = user_id);
-- Insert via server-side triggers/functions only

-- ══════════════════════════════════════════════════════════════════════
-- SHARING & COLLABORATION
-- ══════════════════════════════════════════════════════════════════════

-- ── Shared Deck Access ──────────────────────────────────────────────
create table public.shared_deck_access (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid references public.decks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'viewer' not null,  -- viewer, editor
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  unique(deck_id, user_id)
);

alter table public.shared_deck_access enable row level security;
create policy "Deck owners can manage sharing" on public.shared_deck_access
  for all using (
    deck_id in (select id from public.decks where user_id = auth.uid())
  ) with check (
    deck_id in (select id from public.decks where user_id = auth.uid())
  );
create policy "Grantees can read own access" on public.shared_deck_access
  for select using (auth.uid() = user_id);

-- ── Deck Ratings ────────────────────────────────────────────────────
create table public.deck_ratings (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid references public.decks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz default now() not null,
  unique(deck_id, user_id)
);

alter table public.deck_ratings enable row level security;
create policy "Users can CRUD own ratings" on public.deck_ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Anyone can read ratings on public decks" on public.deck_ratings
  for select using (
    deck_id in (select id from public.decks where is_public = true)
  );

-- ══════════════════════════════════════════════════════════════════════
-- COST, USAGE & NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════

-- ── Cost Tracker ────────────────────────────────────────────────────
create table public.cost_tracker (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  total_input_tokens bigint default 0,
  total_output_tokens bigint default 0,
  total_cost real default 0,
  monthly_limit real default 25.0,
  -- Monthly period tracking
  period_start date default current_date not null,
  period_input_tokens bigint default 0 not null,
  period_output_tokens bigint default 0 not null,
  period_cost real default 0 not null,
  -- Daily rate limiting
  daily_generation_count integer default 0 not null,
  daily_generation_date date,
  updated_at timestamptz default now()
);

alter table public.cost_tracker enable row level security;
create policy "Users can CRUD own cost tracker" on public.cost_tracker
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── AI Generation Log ───────────────────────────────────────────────
-- Detailed log of every AI generation request
create table public.ai_generation_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  deck_id uuid references public.decks(id) on delete set null,
  source_type text not null,            -- topic, youtube, pdf, document, image, paste
  source_preview text,                  -- first 500 chars of source
  model text not null,
  input_tokens integer default 0 not null,
  output_tokens integer default 0 not null,
  cost real default 0 not null,
  cards_generated integer default 0 not null,
  difficulty_requested text,
  duration_ms integer,
  status text default 'completed' not null, -- completed, failed, cancelled
  error_message text,
  created_at timestamptz default now() not null
);

alter table public.ai_generation_log enable row level security;
create policy "Users can read own generation logs" on public.ai_generation_log
  for select using (auth.uid() = user_id);
create policy "Users can insert own generation logs" on public.ai_generation_log
  for insert with check (auth.uid() = user_id);

create index idx_ai_gen_log_user on public.ai_generation_log(user_id, created_at desc);

-- ── Import/Export Log ───────────────────────────────────────────────
create table public.import_export_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  direction text not null,              -- import, export
  format text not null,                 -- csv, json, apkg, anki_txt
  deck_id uuid references public.decks(id) on delete set null,
  card_count integer default 0 not null,
  status text default 'pending' not null, -- pending, processing, completed, failed
  error_message text,
  file_name text,
  file_size_bytes integer,
  created_at timestamptz default now() not null,
  completed_at timestamptz
);

alter table public.import_export_log enable row level security;
create policy "Users can CRUD own import/export logs" on public.import_export_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Notifications ───────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,                   -- study_reminder, streak_warning, achievement, deck_shared, system
  title text not null,
  body text,
  is_read boolean default false not null,
  action_url text,                      -- deep link (e.g. /study/deck-id)
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

alter table public.notifications enable row level security;
create policy "Users can read and update own notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_notifications_unread on public.notifications(user_id, is_read, created_at desc)
  where is_read = false;

-- ── User Preferences ────────────────────────────────────────────────
create table public.user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, key)
);

alter table public.user_preferences enable row level security;
create policy "Users can CRUD own preferences" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════

-- ── Update deck card count ──────────────────────────────────────────
create or replace function public.update_deck_card_count(deck_id_input uuid)
returns void as $$
begin
  update public.decks
  set card_count = (select count(*) from public.cards where deck_id = deck_id_input),
      updated_at = now()
  where id = deck_id_input;
end;
$$ language plpgsql security definer;

-- ── Increment cost tracker ──────────────────────────────────────────
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
    -- Also update period tracking
    period_input_tokens = case
      when cost_tracker.period_start < date_trunc('month', current_date) then input_tokens_add
      else cost_tracker.period_input_tokens + input_tokens_add
    end,
    period_output_tokens = case
      when cost_tracker.period_start < date_trunc('month', current_date) then output_tokens_add
      else cost_tracker.period_output_tokens + output_tokens_add
    end,
    period_cost = case
      when cost_tracker.period_start < date_trunc('month', current_date) then cost_add
      else cost_tracker.period_cost + cost_add
    end,
    period_start = case
      when cost_tracker.period_start < date_trunc('month', current_date) then current_date
      else cost_tracker.period_start
    end,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- ── Get deck statistics (for Progress page) ─────────────────────────
create or replace function public.get_deck_stats(user_id_input uuid)
returns table(
  deck_id uuid,
  total_cards bigint,
  new_cards bigint,
  learning_cards bigint,
  review_cards bigint,
  mastered_cards bigint,
  average_retention real,
  total_reviews bigint
) as $$
begin
  return query
  select
    d.id as deck_id,
    count(distinct c.id) as total_cards,
    count(distinct c.id) filter (where cp.state is null or cp.state = 0) as new_cards,
    count(distinct c.id) filter (where cp.state = 1) as learning_cards,
    count(distinct c.id) filter (where cp.state = 2) as review_cards,
    count(distinct c.id) filter (where cp.state = 2 and cp.interval_days >= 21) as mastered_cards,
    case when count(rl.id) > 0
      then (count(rl.id) filter (where rl.rating >= 3))::real / count(rl.id)::real
      else 0
    end as average_retention,
    count(rl.id) as total_reviews
  from public.decks d
  left join public.cards c on c.deck_id = d.id
  left join public.card_progress cp on cp.card_id = c.id and cp.user_id = user_id_input
  left join public.review_log rl on rl.card_id = c.id and rl.user_id = user_id_input
  where d.user_id = user_id_input
  group by d.id;
end;
$$ language plpgsql security definer;

-- ── Clone a public deck ─────────────────────────────────────────────
create or replace function public.clone_deck(
  source_deck_id uuid,
  target_user_id uuid
) returns uuid as $$
declare
  new_deck_id uuid;
begin
  if not exists (select 1 from public.decks where id = source_deck_id and is_public = true) then
    raise exception 'Deck is not public';
  end if;

  insert into public.decks (user_id, title, description, source, source_type, original_deck_id)
  select target_user_id, title, description, source, source_type, source_deck_id
  from public.decks where id = source_deck_id
  returning id into new_deck_id;

  insert into public.cards (deck_id, front, back, explanation, mnemonic, difficulty, card_type, position)
  select new_deck_id, front, back, explanation, mnemonic, difficulty, card_type, position
  from public.cards where deck_id = source_deck_id
  order by position;

  perform public.update_deck_card_count(new_deck_id);

  update public.decks set clone_count = clone_count + 1 where id = source_deck_id;

  return new_deck_id;
end;
$$ language plpgsql security definer;

-- ── Monthly cost reset ──────────────────────────────────────────────
create or replace function public.reset_monthly_costs()
returns void as $$
begin
  update public.cost_tracker
  set period_input_tokens = 0,
      period_output_tokens = 0,
      period_cost = 0,
      period_start = current_date,
      updated_at = now()
  where period_start < date_trunc('month', current_date);
end;
$$ language plpgsql security definer;

-- ══════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════

-- ── Auto-update updated_at timestamps ───────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.decks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ── Auto-create user profile + streak on signup ─────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  insert into public.streaks (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Auto-update deck study stats after session ──────────────────────
create or replace function public.update_deck_study_stats()
returns trigger as $$
begin
  update public.decks
  set last_studied_at = now(),
      total_study_time_seconds = total_study_time_seconds + new.duration_seconds,
      updated_at = now()
  where id = new.deck_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_study_session_created
  after insert on public.study_sessions
  for each row execute function public.update_deck_study_stats();

-- ── Auto-update streak after study session ──────────────────────────
create or replace function public.update_streak()
returns trigger as $$
declare
  user_tz text;
  study_date date;
  current_rec record;
begin
  select timezone into user_tz from public.user_profiles where user_id = new.user_id;
  user_tz := coalesce(user_tz, 'UTC');
  study_date := (now() at time zone user_tz)::date;

  select * into current_rec from public.streaks where user_id = new.user_id;

  if current_rec is null then
    insert into public.streaks (user_id, current_streak, longest_streak, last_study_date, streak_start_date, total_study_days)
    values (new.user_id, 1, 1, study_date, study_date, 1);
  elsif current_rec.last_study_date = study_date then
    null; -- already studied today
  elsif current_rec.last_study_date = study_date - 1 then
    update public.streaks set
      current_streak = current_streak + 1,
      longest_streak = greatest(longest_streak, current_streak + 1),
      last_study_date = study_date,
      total_study_days = total_study_days + 1,
      updated_at = now()
    where user_id = new.user_id;
  else
    update public.streaks set
      current_streak = 1,
      last_study_date = study_date,
      streak_start_date = study_date,
      total_study_days = total_study_days + 1,
      updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_session_update_streak
  after insert on public.study_sessions
  for each row execute function public.update_streak();

-- ── Auto-detect leech cards ─────────────────────────────────────────
create or replace function public.check_leech()
returns trigger as $$
begin
  if new.lapses >= 8 and (old.lapses is null or old.lapses < 8) then
    new.is_leech := true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_progress_check_leech
  before update on public.card_progress
  for each row execute function public.check_leech();
