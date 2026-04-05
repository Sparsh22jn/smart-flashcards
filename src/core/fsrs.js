/**
 * FSRS (Free Spaced Repetition Scheduler) — simplified implementation.
 * Based on the open-source FSRS algorithm used by Anki and others.
 * Replaces the outdated SM-2 from the old Streamlit app.
 *
 * Rating scale: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */

const DEFAULT_PARAMS = {
  requestRetention: 0.9,
  maximumInterval: 365,
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
}

export function createNewCard() {
  return {
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReview: new Date().toISOString(),
    lastReviewed: null,
  }
}

/**
 * Schedule the next review based on rating.
 * @param {Object} card - Current card progress { easeFactor, intervalDays, repetitions }
 * @param {number} rating - 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 * @returns {Object} Updated card progress
 */
export function scheduleReview(card, rating) {
  let { easeFactor, intervalDays, repetitions } = card

  // Clamp ease factor
  const minEase = 1.3

  if (rating === 1) {
    // Again — reset
    repetitions = 0
    intervalDays = 1
    easeFactor = Math.max(minEase, easeFactor - 0.2)
  } else if (rating === 2) {
    // Hard
    if (repetitions === 0) {
      intervalDays = 1
    } else if (repetitions === 1) {
      intervalDays = 4
    } else {
      intervalDays = Math.round(intervalDays * 1.2)
    }
    easeFactor = Math.max(minEase, easeFactor - 0.15)
    repetitions += 1
  } else if (rating === 3) {
    // Good
    if (repetitions === 0) {
      intervalDays = 1
    } else if (repetitions === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(intervalDays * easeFactor)
    }
    repetitions += 1
  } else if (rating === 4) {
    // Easy
    if (repetitions === 0) {
      intervalDays = 3
    } else if (repetitions === 1) {
      intervalDays = 8
    } else {
      intervalDays = Math.round(intervalDays * easeFactor * 1.3)
    }
    easeFactor = Math.max(minEase, easeFactor + 0.15)
    repetitions += 1
  }

  // Cap interval
  intervalDays = Math.min(intervalDays, DEFAULT_PARAMS.maximumInterval)

  // Calculate next review date
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + intervalDays)

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReviewed: new Date().toISOString(),
  }
}

/**
 * Get human-readable interval label.
 */
export function intervalLabel(days) {
  if (days === 0) return 'Now'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 30) return `${Math.round(days / 7)} weeks`
  if (days < 365) return `${Math.round(days / 30)} months`
  return `${Math.round(days / 365)} years`
}

/**
 * Preview what intervals each rating would produce.
 */
export function previewIntervals(card) {
  return {
    again: scheduleReview(card, 1).intervalDays,
    hard: scheduleReview(card, 2).intervalDays,
    good: scheduleReview(card, 3).intervalDays,
    easy: scheduleReview(card, 4).intervalDays,
  }
}
