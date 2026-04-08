import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FlashCard from '../components/FlashCard'
import RatingButtons from '../components/RatingButtons'
import { fetchStudyQueue, upsertCardProgress, insertStudySession, insertReviewLog } from '../lib/data'
import { scheduleReview, State } from '../core/fsrs'

/**
 * Interleave new cards evenly among reviews.
 * Learning cards go first (they're overdue from prior sessions).
 */
function buildQueue(learning, reviews, newCards) {
  if (reviews.length === 0 && newCards.length === 0) return [...learning]
  if (newCards.length === 0) return [...learning, ...reviews]
  if (reviews.length === 0) return [...learning, ...newCards]

  const mixed = []
  const step = Math.max(1, Math.ceil(reviews.length / newCards.length))
  let ni = 0
  for (let i = 0; i < reviews.length; i++) {
    mixed.push(reviews[i])
    if ((i + 1) % step === 0 && ni < newCards.length) {
      mixed.push(newCards[ni++])
    }
  }
  while (ni < newCards.length) mixed.push(newCards[ni++])

  return [...learning, ...mixed]
}

/**
 * Study / Review page — Anki-style queue-based study with learning steps,
 * re-insertion of forgotten cards, waiting screen, and detailed session stats.
 */
export default function Study({ user }) {
  const { deckId } = useParams()
  const navigate = useNavigate()

  // Core queue state
  const [queue, setQueue] = useState([])
  const [waitingCards, setWaitingCards] = useState([])
  const [currentItem, setCurrentItem] = useState(null)
  const [deckSettings, setDeckSettings] = useState(null)

  // UI state
  const [showAnswer, setShowAnswer] = useState(false)
  const [showELI5, setShowELI5] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [complete, setComplete] = useState(false)
  const [deckEmpty, setDeckEmpty] = useState(false)
  const [waitingUntil, setWaitingUntil] = useState(null)
  const [countdown, setCountdown] = useState(null)

  // Session stats
  const [sessionStats, setSessionStats] = useState({
    studied: 0, correct: 0,
    newCount: 0, reviewCount: 0, relearnCount: 0,
    againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0,
    startTime: Date.now(),
  })
  const [cardStartTime, setCardStartTime] = useState(Date.now())

  // Refs for timer access (avoids stale closures)
  const waitingRef = useRef([])
  const queueRef = useRef([])
  useEffect(() => { waitingRef.current = waitingCards }, [waitingCards])
  useEffect(() => { queueRef.current = queue }, [queue])

  // ── Anki-style queue counters ─────────────────────────────────────
  const queueCounts = useMemo(() => {
    let newC = 0, learningC = 0, reviewC = 0
    for (const item of queue) {
      if (item.category === 'new') newC++
      else if (item.category === 'learning') learningC++
      else if (item.category === 'review') reviewC++
    }
    if (currentItem) {
      if (currentItem.category === 'new') newC++
      else if (currentItem.category === 'learning') learningC++
      else if (currentItem.category === 'review') reviewC++
    }
    learningC += waitingCards.length
    return { new: newC, learning: learningC, review: reviewC }
  }, [queue, currentItem, waitingCards])

  // ── Load study queue on mount ─────────────────────────────────────
  const loadQueue = useCallback(() => {
    if (!deckId || !user) return
    setLoading(true)
    setComplete(false)
    setWaitingUntil(null)
    setCurrentItem(null)
    setQueue([])
    setWaitingCards([])
    setSessionStats({
      studied: 0, correct: 0,
      newCount: 0, reviewCount: 0, relearnCount: 0,
      againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0,
      startTime: Date.now(),
    })

    fetchStudyQueue(user.id, deckId).then(data => {
      setDeckSettings(data.deckSettings)
      if (data.totalCards === 0) {
        setDeckEmpty(true)
        setLoading(false)
        return
      }
      setDeckEmpty(false)
      const q = buildQueue(data.learning, data.review, data.new)
      if (q.length > 0) {
        setCurrentItem(q[0])
        setQueue(q.slice(1))
      }
      setLoading(false)
    }).catch(err => {
      console.error('fetchStudyQueue error:', err)
      setLoading(false)
    })
  }, [deckId, user])

  useEffect(() => { loadQueue() }, [loadQueue])

  // ── Countdown timer for waiting screen ────────────────────────────
  useEffect(() => {
    if (!waitingUntil || currentItem) {
      setCountdown(null)
      return
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((waitingUntil.getTime() - Date.now()) / 1000))
      setCountdown(remaining)

      if (remaining <= 0) {
        const now = new Date()
        const w = waitingRef.current
        const due = w.filter(item => new Date(item.progress.nextReview) <= now)
        const still = w.filter(item => new Date(item.progress.nextReview) > now)

        if (due.length > 0) {
          due.sort((a, b) => new Date(a.progress.nextReview) - new Date(b.progress.nextReview))
          setCurrentItem(due[0])
          setWaitingCards([...due.slice(1), ...still])
          setCardStartTime(Date.now())
          setWaitingUntil(null)
          setShowAnswer(false)
        } else if (queueRef.current.length > 0) {
          setCurrentItem(queueRef.current[0])
          setQueue(prev => prev.slice(1))
          setCardStartTime(Date.now())
          setWaitingUntil(null)
          setShowAnswer(false)
        } else if (still.length > 0) {
          // Cards still waiting — update countdown to next due time
          const nextDue = still.reduce((min, item) => {
            const t = new Date(item.progress.nextReview)
            return t < min ? t : min
          }, new Date(still[0].progress.nextReview))
          setWaitingUntil(nextDue)
        } else {
          // No cards left anywhere — session complete
          setWaitingUntil(null)
          setWaitingCards([])
          setComplete(true)
        }
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [waitingUntil, currentItem])

  // ── Save session helper ───────────────────────────────────────────
  const saveSession = useCallback(async (stats) => {
    const duration = Math.round((Date.now() - stats.startTime) / 1000)
    await insertStudySession(user.id, {
      deckId,
      cardsStudied: stats.studied,
      correctCount: stats.correct,
      duration,
      newCount: stats.newCount,
      reviewCount: stats.reviewCount,
      relearnCount: stats.relearnCount,
      againCount: stats.againCount,
      hardCount: stats.hardCount,
      goodCount: stats.goodCount,
      easyCount: stats.easyCount,
      averageTimePerCardMs: stats.studied > 0 ? Math.round(duration * 1000 / stats.studied) : null,
    }).catch(err => console.error('insertStudySession error:', err))
  }, [user, deckId])

  // ── Rate card ─────────────────────────────────────────────────────
  const handleRate = useCallback(async (rating) => {
    if (!currentItem || !user) return

    const { card, progress: oldProgress, category } = currentItem
    const timeSpentMs = Date.now() - cardStartTime
    const updated = scheduleReview(oldProgress, rating, deckSettings)

    // Persist to DB
    await upsertCardProgress(user.id, card.id, updated)

    // Log review (non-blocking)
    insertReviewLog(user.id, {
      cardId: card.id,
      deckId,
      rating,
      stateBefore: oldProgress.state ?? 0,
      stateAfter: updated.state,
      stabilityBefore: oldProgress.stability,
      stabilityAfter: updated.stability,
      difficultyBefore: oldProgress.difficulty,
      difficultyAfter: updated.difficulty,
      easeFactorBefore: oldProgress.easeFactor,
      intervalBeforeDays: oldProgress.intervalDays ?? 0,
      intervalAfterDays: updated.intervalDays,
      elapsedDays: updated.elapsedDays,
      timeSpentMs,
    }).catch(() => {})

    // Update stats
    const isLapse = updated.state === State.Relearning && oldProgress.state === State.Review
    const newStats = {
      studied: sessionStats.studied + 1,
      correct: sessionStats.correct + (rating >= 3 ? 1 : 0),
      newCount: sessionStats.newCount + (category === 'new' ? 1 : 0),
      reviewCount: sessionStats.reviewCount + (category === 'review' ? 1 : 0),
      relearnCount: sessionStats.relearnCount + (isLapse ? 1 : 0),
      againCount: sessionStats.againCount + (rating === 1 ? 1 : 0),
      hardCount: sessionStats.hardCount + (rating === 2 ? 1 : 0),
      goodCount: sessionStats.goodCount + (rating === 3 ? 1 : 0),
      easyCount: sessionStats.easyCount + (rating === 4 ? 1 : 0),
      startTime: sessionStats.startTime,
    }
    setSessionStats(newStats)

    // Build updated waiting list
    let newWaiting = [...waitingCards]
    if (updated.state === State.Learning || updated.state === State.Relearning) {
      newWaiting.push({ card, progress: updated, category: 'learning' })
    }

    // Find next card to show
    const now = new Date()
    const dueFromWaiting = newWaiting.filter(w => new Date(w.progress.nextReview) <= now)
    const stillWaiting = newWaiting.filter(w => new Date(w.progress.nextReview) > now)

    let nextItem = null
    let nextQueue = [...queue]
    let nextWaiting = stillWaiting

    if (dueFromWaiting.length > 0) {
      dueFromWaiting.sort((a, b) => new Date(a.progress.nextReview) - new Date(b.progress.nextReview))
      nextItem = dueFromWaiting[0]
      nextWaiting = [...dueFromWaiting.slice(1), ...stillWaiting]
    } else if (nextQueue.length > 0) {
      nextItem = nextQueue[0]
      nextQueue = nextQueue.slice(1)
      nextWaiting = newWaiting // none were due, keep all
    } else {
      nextWaiting = newWaiting
    }

    setQueue(nextQueue)
    setWaitingCards(nextWaiting)
    setShowAnswer(false)
    setShowELI5(false)
    setShowMnemonic(false)
    setCardStartTime(Date.now())

    if (nextItem) {
      setCurrentItem(nextItem)
      setWaitingUntil(null)
    } else if (nextWaiting.length > 0) {
      // Show waiting screen
      setCurrentItem(null)
      const earliest = nextWaiting.reduce((min, w) => {
        const t = new Date(w.progress.nextReview)
        return t < min ? t : min
      }, new Date(nextWaiting[0].progress.nextReview))
      setWaitingUntil(earliest)
    } else {
      // Session complete
      setCurrentItem(null)
      setComplete(true)
      await saveSession(newStats)
    }
  }, [currentItem, user, queue, waitingCards, deckSettings, sessionStats, deckId, cardStartTime, saveSession])

  // ── End session early ─────────────────────────────────────────────
  const endSessionEarly = useCallback(async () => {
    if (sessionStats.studied === 0) {
      navigate('/library')
      return
    }
    setCurrentItem(null)
    setWaitingUntil(null)
    setComplete(true)
    await saveSession(sessionStats)
  }, [sessionStats, navigate, saveSession])

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <span className="text-on-surface-variant text-sm">Loading cards...</span>
      </div>
    )
  }

  // ── Empty deck ────────────────────────────────────────────────────
  if (deckEmpty) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6">
        <span className="material-symbols-outlined text-outline-variant text-4xl mb-4">school</span>
        <p className="text-on-surface-variant">No cards in this deck yet.</p>
        <button onClick={() => navigate(-1)} className="text-primary font-medium mt-4">Go back</button>
      </div>
    )
  }

  // ── Nothing due ───────────────────────────────────────────────────
  if (!currentItem && !complete && !waitingUntil) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-primary text-4xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
        <h2 className="font-headline text-2xl font-bold mb-2">You're all caught up!</h2>
        <p className="text-on-surface-variant text-sm">No cards due right now. Check back later.</p>
        <button onClick={() => navigate('/library')} className="text-primary font-medium mt-6">Back to Library</button>
      </div>
    )
  }

  // ── Completion screen ─────────────────────────────────────────────
  if (complete) {
    const accuracy = sessionStats.studied > 0
      ? Math.round((sessionStats.correct / sessionStats.studied) * 100) : 0
    const duration = Math.round((Date.now() - sessionStats.startTime) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-primary-container/30 flex items-center justify-center mb-8">
          <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            celebration
          </span>
        </div>
        <h2 className="font-headline text-3xl font-extrabold mb-6">Session Complete</h2>

        {/* Summary */}
        <div className="flex gap-8 mb-6 text-center">
          <div>
            <p className="text-3xl font-headline font-bold text-on-surface">{sessionStats.studied}</p>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest mt-1">Cards</p>
          </div>
          <div>
            <p className="text-3xl font-headline font-bold text-primary">{accuracy}%</p>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest mt-1">Accuracy</p>
          </div>
          <div>
            <p className="text-3xl font-headline font-bold text-on-surface">{minutes}:{String(seconds).padStart(2, '0')}</p>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest mt-1">Time</p>
          </div>
        </div>

        {/* Card type breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-sm w-full max-w-xs">
          <div className="text-center">
            <p className="font-bold text-blue-400">{sessionStats.newCount}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">New</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-green-400">{sessionStats.reviewCount}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Review</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-orange-400">{sessionStats.relearnCount}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Relearn</p>
          </div>
        </div>

        {/* Rating breakdown */}
        <div className="flex gap-6 mb-8 text-[10px] text-on-surface-variant uppercase tracking-wider">
          <span>Again: {sessionStats.againCount}</span>
          <span>Hard: {sessionStats.hardCount}</span>
          <span>Good: {sessionStats.goodCount}</span>
          <span>Easy: {sessionStats.easyCount}</span>
        </div>

        <div className="flex gap-4">
          <button
            onClick={loadQueue}
            className="px-6 py-3 rounded-full ghost-border text-on-surface font-medium pressable"
          >
            Study Again
          </button>
          <button
            onClick={() => navigate('/library')}
            className="px-6 py-3 rounded-full primary-gradient text-on-primary font-bold editorial-shadow pressable"
          >
            Back to Library
          </button>
        </div>
      </div>
    )
  }

  // ── Waiting screen ────────────────────────────────────────────────
  if (waitingUntil && !currentItem) {
    const mins = Math.floor((countdown || 0) / 60)
    const secs = (countdown || 0) % 60

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-primary text-5xl mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>
          hourglass_top
        </span>
        <h2 className="font-headline text-2xl font-bold mb-2">Next card due in</h2>
        <p className="text-5xl font-headline font-black text-primary mb-8">
          {mins}:{String(secs).padStart(2, '0')}
        </p>
        <p className="text-sm text-on-surface-variant mb-8">
          {waitingCards.length} card{waitingCards.length !== 1 ? 's' : ''} in learning
        </p>
        <button
          onClick={endSessionEarly}
          className="px-6 py-3 rounded-full ghost-border text-on-surface font-medium pressable"
        >
          End session early
        </button>
      </div>
    )
  }

  // ── Active study screen ───────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6">
      {/* Queue counters (Anki-style: blue=new, orange=learning, green=review) */}
      <div className="w-full max-w-2xl mb-12">
        <div className="flex justify-between items-end mb-2">
          <div className="flex gap-4 font-label text-[11px] uppercase tracking-widest">
            <span className="text-blue-400 font-bold">{queueCounts.new}</span>
            <span className="text-orange-400 font-bold">{queueCounts.learning}</span>
            <span className="text-green-400 font-bold">{queueCounts.review}</span>
          </div>
          {sessionStats.studied > 0 && (
            <span className="font-label text-[11px] uppercase tracking-widest text-primary font-bold">
              {Math.round((sessionStats.correct / sessionStats.studied) * 100)}% Accuracy
            </span>
          )}
        </div>
        <div className="h-[2px] w-full bg-surface-container overflow-hidden">
          {(() => {
            const total = queueCounts.new + queueCounts.learning + queueCounts.review + sessionStats.studied
            if (total === 0) return null
            const pct = (sessionStats.studied / total) * 100
            return (
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            )
          })()}
        </div>
      </div>

      {/* Flashcard */}
      <FlashCard
        key={currentItem.card.id}
        card={currentItem.card}
        flipped={showAnswer}
        onFlip={() => setShowAnswer(prev => !prev)}
        showExplanation={showELI5}
        showMnemonic={showMnemonic}
        onRequestELI5={() => setShowELI5(true)}
        onRequestMnemonic={() => setShowMnemonic(true)}
      />

      {/* Rating buttons — show after revealing answer */}
      {showAnswer && (
        <div className="animate-slide-up">
          <RatingButtons
            cardProgress={currentItem.progress}
            onRate={handleRate}
            deckSettings={deckSettings}
          />
        </div>
      )}

      {/* Reveal button if answer not yet shown */}
      {!showAnswer && (
        <button
          onClick={() => setShowAnswer(true)}
          className="mt-8 px-8 py-3 rounded-full primary-gradient text-on-primary font-bold editorial-shadow pressable"
        >
          Show Answer
        </button>
      )}
    </div>
  )
}
