/**
 * FSRS-like Spaced Repetition Scheduler with Anki-style state machine.
 * States: New(0), Learning(1), Review(2), Relearning(3)
 * Rating scale: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */

export const State = { New: 0, Learning: 1, Review: 2, Relearning: 3 }

const LEARNING_STEPS = [1, 10]       // minutes
const RELEARNING_STEPS = [10]        // minutes
const GRADUATING_INTERVAL = 1        // days
const EASY_INTERVAL = 4              // days
const MAX_INTERVAL = 365
const MIN_EASE = 1.3
const STARTING_EASE = 2.5
const EASY_BONUS = 1.3
const HARD_MODIFIER = 1.2
const LEECH_THRESHOLD = 8

export function createNewCard() {
  return {
    easeFactor: STARTING_EASE,
    intervalDays: 0,
    repetitions: 0,
    nextReview: new Date().toISOString(),
    lastReviewed: null,
    state: State.New,
    stability: null,
    difficulty: null,
    scheduledDays: 0,
    elapsedDays: 0,
    reps: 0,
    lapses: 0,
    lastRating: null,
    isLeech: false,
  }
}

function fuzzInterval(interval) {
  if (interval <= 2) return interval
  const fuzz = interval < 7 ? 1
    : interval < 30 ? Math.max(1, Math.round(interval * 0.15))
    : Math.max(1, Math.round(interval * 0.05))
  return interval + Math.floor(Math.random() * (fuzz * 2 + 1)) - fuzz
}

function getStepIndex(scheduledDays, steps) {
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < steps.length; i++) {
    const dist = Math.abs(steps[i] - scheduledDays)
    if (dist < bestDist) { bestDist = dist; bestIdx = i }
  }
  return bestIdx
}

/**
 * Schedule the next review based on rating.
 * @param {Object} card  - Current card progress
 * @param {number} rating - 1-4
 * @param {Object} [deckSettings] - Optional per-deck overrides
 * @param {Object} [opts] - { preview: true } disables fuzz
 */
export function scheduleReview(card, rating, deckSettings, opts) {
  const now = new Date()
  const preview = opts?.preview ?? false

  let {
    easeFactor = STARTING_EASE,
    intervalDays = 0,
    repetitions = 0,
    state = State.New,
    stability = null,
    difficulty = null,
    scheduledDays = 0,
    reps = 0,
    lapses = 0,
    isLeech = false,
  } = card

  reps += 1

  const learningSteps = deckSettings?.learningSteps || LEARNING_STEPS
  const relearningSteps = deckSettings?.relearningSteps || RELEARNING_STEPS
  const graduatingInterval = deckSettings?.graduatingInterval || GRADUATING_INTERVAL
  const easyInterval = deckSettings?.easyInterval || EASY_INTERVAL

  let nextReview, newState = state, newScheduledDays = scheduledDays

  const applyFuzz = (v) => preview ? v : fuzzInterval(v)

  // ── New / Learning ──────────────────────────────────────────────
  if (state === State.New || state === State.Learning) {
    const steps = learningSteps
    const stepIdx = state === State.New ? 0 : getStepIndex(scheduledDays, steps)

    if (rating === 1) {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.2)
      newState = State.Learning
      newScheduledDays = steps[0]
      nextReview = new Date(now.getTime() + steps[0] * 60_000)
    } else if (rating === 2) {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15)
      newState = State.Learning
      const dur = Math.round(steps[stepIdx] * 1.5)
      newScheduledDays = dur
      nextReview = new Date(now.getTime() + dur * 60_000)
    } else if (rating === 3) {
      const next = stepIdx + 1
      if (next >= steps.length) {
        newState = State.Review
        intervalDays = graduatingInterval
        newScheduledDays = graduatingInterval
        nextReview = new Date(now.getTime() + graduatingInterval * 86_400_000)
        repetitions += 1
      } else {
        newState = State.Learning
        newScheduledDays = steps[next]
        nextReview = new Date(now.getTime() + steps[next] * 60_000)
      }
    } else {
      // Easy — graduate immediately
      easeFactor = Math.max(MIN_EASE, easeFactor + 0.15)
      newState = State.Review
      intervalDays = easyInterval
      newScheduledDays = easyInterval
      nextReview = new Date(now.getTime() + easyInterval * 86_400_000)
      repetitions += 1
    }
  }
  // ── Review ──────────────────────────────────────────────────────
  else if (state === State.Review) {
    if (rating === 1) {
      lapses += 1
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.2)
      newState = State.Relearning
      newScheduledDays = relearningSteps[0]
      nextReview = new Date(now.getTime() + relearningSteps[0] * 60_000)
      isLeech = lapses >= LEECH_THRESHOLD
    } else if (rating === 2) {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15)
      intervalDays = applyFuzz(Math.min(MAX_INTERVAL, Math.max(intervalDays + 1, Math.round(intervalDays * HARD_MODIFIER))))
      newScheduledDays = intervalDays
      nextReview = new Date(now.getTime() + intervalDays * 86_400_000)
      repetitions += 1
    } else if (rating === 3) {
      intervalDays = applyFuzz(Math.min(MAX_INTERVAL, Math.round(intervalDays * easeFactor)))
      newScheduledDays = intervalDays
      nextReview = new Date(now.getTime() + intervalDays * 86_400_000)
      repetitions += 1
    } else {
      easeFactor = Math.max(MIN_EASE, easeFactor + 0.15)
      intervalDays = applyFuzz(Math.min(MAX_INTERVAL, Math.round(intervalDays * easeFactor * EASY_BONUS)))
      newScheduledDays = intervalDays
      nextReview = new Date(now.getTime() + intervalDays * 86_400_000)
      repetitions += 1
    }
  }
  // ── Relearning ──────────────────────────────────────────────────
  else if (state === State.Relearning) {
    const steps = relearningSteps
    const stepIdx = getStepIndex(scheduledDays, steps)

    if (rating === 1) {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.2)
      newState = State.Relearning
      newScheduledDays = steps[0]
      nextReview = new Date(now.getTime() + steps[0] * 60_000)
    } else if (rating === 2) {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15)
      newState = State.Relearning
      const dur = Math.round(steps[stepIdx] * 1.5)
      newScheduledDays = dur
      nextReview = new Date(now.getTime() + dur * 60_000)
    } else if (rating === 3) {
      const next = stepIdx + 1
      if (next >= steps.length) {
        newState = State.Review
        intervalDays = Math.max(1, Math.round(intervalDays * 0.7))
        newScheduledDays = intervalDays
        nextReview = new Date(now.getTime() + intervalDays * 86_400_000)
        repetitions += 1
      } else {
        newState = State.Relearning
        newScheduledDays = steps[next]
        nextReview = new Date(now.getTime() + steps[next] * 60_000)
      }
    } else {
      // Easy — graduate immediately
      easeFactor = Math.max(MIN_EASE, easeFactor + 0.15)
      newState = State.Review
      intervalDays = Math.max(1, Math.round(intervalDays * 0.7))
      newScheduledDays = intervalDays
      nextReview = new Date(now.getTime() + intervalDays * 86_400_000)
      repetitions += 1
    }
  }

  // Elapsed days since last review
  let elapsedDays = 0
  if (card.lastReviewed) {
    elapsedDays = Math.max(0, Math.round((now - new Date(card.lastReviewed)) / 86_400_000))
  }

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReviewed: now.toISOString(),
    state: newState,
    stability,
    difficulty,
    scheduledDays: newScheduledDays,
    elapsedDays,
    reps,
    lapses,
    lastRating: rating,
    isLeech,
  }
}

/**
 * Preview intervals for each rating.
 * Returns { again, hard, good, easy } where each is { minutes } or { days }.
 */
export function previewIntervals(card, deckSettings) {
  const names = [['again', 1], ['hard', 2], ['good', 3], ['easy', 4]]
  const out = {}
  for (const [name, rating] of names) {
    const r = scheduleReview(card, rating, deckSettings, { preview: true })
    if (r.state === State.Learning || r.state === State.Relearning) {
      out[name] = { minutes: r.scheduledDays }
    } else {
      out[name] = { days: r.scheduledDays }
    }
  }
  return out
}

/**
 * Human-readable label for a preview interval object.
 */
export function intervalLabel(preview) {
  if (!preview) return ''
  if (preview.minutes !== undefined) {
    const m = preview.minutes
    if (m < 60) return `${m} min`
    return `${Math.round(m / 60)} hr`
  }
  const d = preview.days
  if (d === 0) return 'Now'
  if (d === 1) return '1 day'
  if (d < 7) return `${d} days`
  if (d < 30) {
    const w = Math.round(d / 7)
    return w === 1 ? '1 wk' : `${w} wk`
  }
  if (d < 365) {
    const mo = Math.round(d / 30)
    return mo === 1 ? '1 mo' : `${mo} mo`
  }
  const y = Math.round(d / 365)
  return y === 1 ? '1 yr' : `${y} yr`
}

/**
 * Migrate old SM-2 progress rows to the state-machine model.
 * If a card has reviews but state is still 0/null, treat it as Review.
 */
export function migrateFromSM2(progress) {
  if (progress.repetitions > 0 && (progress.state == null || progress.state === State.New)) {
    return { ...progress, state: State.Review }
  }
  return progress
}
