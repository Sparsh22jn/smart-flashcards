import { supabase } from './supabase'
import { State, createNewCard, migrateFromSM2 } from '../core/fsrs'

// ── Decks ────────────────────────────────────────────────────────────

export async function fetchDecks(userId) {
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(mapDeck)
}

export async function fetchDeck(deckId) {
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .single()
  if (error) throw error
  return mapDeck(data)
}

export async function createDeck(userId, { title, description, source, sourceType }) {
  const { data, error } = await supabase
    .from('decks')
    .insert({
      user_id: userId,
      title,
      description: description || null,
      source: source || null,
      source_type: sourceType || 'topic',
    })
    .select()
    .single()
  if (error) throw error
  return mapDeck(data)
}

export async function updateDeck(deckId, updates) {
  const { data, error } = await supabase
    .from('decks')
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', deckId)
    .select()
    .single()
  if (error) throw error
  return mapDeck(data)
}

export async function deleteDeck(deckId) {
  const { error } = await supabase.from('decks').delete().eq('id', deckId)
  if (error) throw error
}

// ── Cards ────────────────────────────────────────────────────────────

export async function fetchCards(deckId) {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('position', { ascending: true })
  if (error) throw error
  return data.map(mapCard)
}

export async function insertCards(deckId, cards) {
  const rows = cards.map((c, i) => ({
    deck_id: deckId,
    front: c.front,
    back: c.back,
    explanation: c.explanation || null,
    mnemonic: c.mnemonic || null,
    difficulty: c.difficulty || 'medium',
    position: c.position ?? i,
  }))
  const { data, error } = await supabase.from('cards').insert(rows).select()
  if (error) throw error

  // Update deck card count
  await supabase.rpc('update_deck_card_count', { deck_id_input: deckId })

  return data.map(mapCard)
}

export async function updateCard(cardId, updates) {
  const { data, error } = await supabase
    .from('cards')
    .update({
      ...(updates.front !== undefined && { front: updates.front }),
      ...(updates.back !== undefined && { back: updates.back }),
      ...(updates.explanation !== undefined && { explanation: updates.explanation }),
      ...(updates.mnemonic !== undefined && { mnemonic: updates.mnemonic }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId)
    .select()
    .single()
  if (error) throw error
  return mapCard(data)
}

export async function deleteCard(cardId) {
  const { error } = await supabase.from('cards').delete().eq('id', cardId)
  if (error) throw error
}

// ── Deck Progress ───────────────────────────────────────────────────

export async function fetchDeckProgress(userId) {
  const { data, error } = await supabase
    .from('card_progress')
    .select('card_id, interval_days, cards(deck_id)')
    .eq('user_id', userId)
  if (error) throw error

  // Group by deck — count cards with interval >= 21 days as "mastered"
  const progress = {}
  for (const row of data) {
    const deckId = row.cards?.deck_id
    if (!deckId) continue
    if (!progress[deckId]) progress[deckId] = { reviewed: 0, mastered: 0 }
    progress[deckId].reviewed++
    if (row.interval_days >= 21) progress[deckId].mastered++
  }
  return progress
}

// ── Study Queue (Anki-style) ─────────────────────────────────────────

export async function fetchStudyQueue(userId, deckId) {
  // 1. Fetch deck with settings
  const { data: deckData, error: deckErr } = await supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .single()
  if (deckErr) throw deckErr
  const deck = mapDeck(deckData)

  const deckSettings = {
    newCardsPerDay: deck.newCardsPerDay,
    reviewCardsPerDay: deck.reviewCardsPerDay,
    desiredRetention: deck.desiredRetention,
  }

  // 2. Fetch all non-suspended cards
  const { data: cardsData, error: cardsErr } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .eq('is_suspended', false)
    .order('position', { ascending: true })
  if (cardsErr) throw cardsErr
  const cards = cardsData.map(mapCard)

  if (cards.length === 0) {
    return {
      learning: [], review: [], new: [],
      counts: { learning: 0, review: 0, new: 0, total: 0 },
      progressMap: {}, deckSettings, totalCards: 0,
    }
  }

  // 3. Fetch card_progress via join on deck
  const { data: progressData, error: progErr } = await supabase
    .from('card_progress')
    .select('*, cards!inner(deck_id)')
    .eq('user_id', userId)
    .eq('cards.deck_id', deckId)
  if (progErr) throw progErr

  const progressMap = {}
  for (const row of progressData) {
    progressMap[row.card_id] = mapProgress(row)
  }

  // 4. Count new cards already introduced today (from review_log)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: newCardsToday, error: countErr } = await supabase
    .from('review_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .eq('state_before', 0)
    .gte('reviewed_at', todayStart.toISOString())

  const newIntroducedToday = countErr ? 0 : (newCardsToday || 0)

  // 5. Categorize cards
  const now = new Date()
  const learning = []
  const review = []
  const newCards = []

  for (const card of cards) {
    const prog = progressMap[card.id]
    if (!prog) {
      newCards.push({ card, progress: createNewCard(), category: 'new' })
    } else if (prog.state === State.New && prog.reps === 0) {
      newCards.push({ card, progress: prog, category: 'new' })
    } else if (prog.state === State.Learning || prog.state === State.Relearning) {
      if (new Date(prog.nextReview) <= now) {
        learning.push({ card, progress: prog, category: 'learning' })
      }
    } else if (prog.state === State.Review) {
      if (new Date(prog.nextReview) <= now) {
        review.push({ card, progress: prog, category: 'review' })
      }
    }
  }

  // 6. Apply daily limits
  const newLimit = Math.max(0, deckSettings.newCardsPerDay - newIntroducedToday)
  const limitedNew = newCards.slice(0, newLimit)
  const limitedReview = review.slice(0, deckSettings.reviewCardsPerDay)

  return {
    learning,
    review: limitedReview,
    new: limitedNew,
    counts: {
      learning: learning.length,
      review: limitedReview.length,
      new: limitedNew.length,
      total: learning.length + limitedReview.length + limitedNew.length,
    },
    progressMap,
    deckSettings,
    totalCards: cards.length,
  }
}

// ── Study Progress (Spaced Repetition) ───────────────────────────────

export async function fetchDueCards(userId) {
  const { data, error } = await supabase
    .from('card_progress')
    .select('*, cards(*)')
    .eq('user_id', userId)
    .lte('next_review', new Date().toISOString())
    .order('next_review', { ascending: true })
  if (error) throw error
  return data
}

export async function upsertCardProgress(userId, cardId, review) {
  const { data, error } = await supabase
    .from('card_progress')
    .upsert({
      user_id: userId,
      card_id: cardId,
      ease_factor: review.easeFactor,
      interval_days: review.intervalDays,
      repetitions: review.repetitions,
      next_review: review.nextReview,
      last_reviewed: review.lastReviewed || new Date().toISOString(),
      state: review.state ?? 0,
      stability: review.stability ?? null,
      difficulty: review.difficulty ?? null,
      scheduled_days: review.scheduledDays ?? 0,
      elapsed_days: review.elapsedDays ?? 0,
      reps: review.reps ?? 0,
      lapses: review.lapses ?? 0,
      last_rating: review.lastRating ?? null,
      is_leech: review.isLeech ?? false,
    }, { onConflict: 'user_id,card_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Study Sessions ───────────────────────────────────────────────────

export async function insertStudySession(userId, {
  deckId, cardsStudied, correctCount, duration,
  newCount, reviewCount, relearnCount,
  againCount, hardCount, goodCount, easyCount,
  averageTimePerCardMs, mode,
}) {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: userId,
      deck_id: deckId,
      cards_studied: cardsStudied,
      correct_count: correctCount,
      duration_seconds: duration,
      new_count: newCount ?? 0,
      review_count: reviewCount ?? 0,
      relearn_count: relearnCount ?? 0,
      again_count: againCount ?? 0,
      hard_count: hardCount ?? 0,
      good_count: goodCount ?? 0,
      easy_count: easyCount ?? 0,
      average_time_per_card_ms: averageTimePerCardMs ?? null,
      mode: mode ?? 'normal',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchStudySessions(userId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

// ── Review Log ──────────────────────────────────────────────────────

export async function insertReviewLog(userId, { cardId, deckId, rating, stateBefore, stateAfter, stabilityBefore, stabilityAfter, difficultyBefore, difficultyAfter, easeFactorBefore, intervalBeforeDays, intervalAfterDays, elapsedDays, timeSpentMs }) {
  const { error } = await supabase
    .from('review_log')
    .insert({
      user_id: userId,
      card_id: cardId,
      deck_id: deckId,
      rating,
      state_before: stateBefore ?? 0,
      state_after: stateAfter ?? 0,
      stability_before: stabilityBefore ?? null,
      stability_after: stabilityAfter ?? null,
      difficulty_before: difficultyBefore ?? null,
      difficulty_after: difficultyAfter ?? null,
      ease_factor_before: easeFactorBefore ?? null,
      interval_before_days: intervalBeforeDays ?? 0,
      interval_after_days: intervalAfterDays ?? 0,
      elapsed_days: elapsedDays ?? 0,
      time_spent_ms: timeSpentMs ?? null,
    })
  if (error) console.error('review_log insert error:', error)
}

// ── User Profile ────────────────────────────────────────────────────

export async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ── Streaks ─────────────────────────────────────────────────────────

export async function fetchStreak(userId) {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ── Cost Tracking ────────────────────────────────────────────────────

export async function fetchCostTracker(userId) {
  const { data, error } = await supabase
    .from('cost_tracker')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function updateCostTracker(userId, { inputTokens, outputTokens, cost }) {
  const { data, error } = await supabase.rpc('increment_cost', {
    user_id_input: userId,
    input_tokens_add: inputTokens,
    output_tokens_add: outputTokens,
    cost_add: cost,
  })
  if (error) throw error
  return data
}

// ── Mappers ──────────────────────────────────────────────────────────

function mapDeck(d) {
  return {
    id: d.id,
    userId: d.user_id,
    title: d.title,
    description: d.description,
    source: d.source,
    sourceType: d.source_type,
    cardCount: d.card_count,
    newCardsPerDay: d.new_cards_per_day ?? 20,
    reviewCardsPerDay: d.review_cards_per_day ?? 200,
    desiredRetention: d.desired_retention ?? 0.9,
    fsrsWeights: d.fsrs_weights,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }
}

function mapCard(c) {
  return {
    id: c.id,
    deckId: c.deck_id,
    front: c.front,
    back: c.back,
    explanation: c.explanation,
    mnemonic: c.mnemonic,
    difficulty: c.difficulty,
    position: c.position,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

export function mapProgress(row) {
  const progress = {
    easeFactor: row.ease_factor ?? 2.5,
    intervalDays: row.interval_days ?? 0,
    repetitions: row.repetitions ?? 0,
    nextReview: row.next_review,
    lastReviewed: row.last_reviewed,
    state: row.state ?? 0,
    stability: row.stability,
    difficulty: row.difficulty,
    scheduledDays: row.scheduled_days ?? 0,
    elapsedDays: row.elapsed_days ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    lastRating: row.last_rating,
    isLeech: row.is_leech ?? false,
  }
  return migrateFromSM2(progress)
}
