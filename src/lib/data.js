import { supabase } from './supabase'

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
      last_reviewed: new Date().toISOString(),
    }, { onConflict: 'user_id,card_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Study Sessions ───────────────────────────────────────────────────

export async function insertStudySession(userId, { deckId, cardsStudied, correctCount, duration }) {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: userId,
      deck_id: deckId,
      cards_studied: cardsStudied,
      correct_count: correctCount,
      duration_seconds: duration,
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
