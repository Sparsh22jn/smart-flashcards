import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FlashCard from '../components/FlashCard'
import RatingButtons from '../components/RatingButtons'
import { fetchCards, upsertCardProgress, insertStudySession, insertReviewLog } from '../lib/data'
import { createNewCard, scheduleReview } from '../core/fsrs'

/**
 * Study / Review page — based on Study.html Stitch design.
 * Full-screen card study with spaced repetition rating.
 */
export default function Study({ user, cardProgressMap, onProgressUpdate }) {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showELI5, setShowELI5] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionStats, setSessionStats] = useState({ studied: 0, correct: 0, startTime: Date.now() })
  const [cardStartTime, setCardStartTime] = useState(Date.now())
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    if (!deckId) return
    setLoading(true)
    fetchCards(deckId)
      .then(c => {
        setCards(c)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [deckId])

  const currentCard = cards[currentIdx]
  const progress = currentCard
    ? (cardProgressMap?.[currentCard.id] || createNewCard())
    : createNewCard()

  const handleRate = useCallback(async (rating) => {
    if (!currentCard || !user) return

    const timeSpentMs = Date.now() - cardStartTime
    const updated = scheduleReview(progress, rating)

    // Save to DB
    await upsertCardProgress(user.id, currentCard.id, updated)
    onProgressUpdate?.(currentCard.id, updated)

    // Log review (non-blocking)
    insertReviewLog(user.id, {
      cardId: currentCard.id,
      deckId,
      rating,
      stateBefore: progress.state ?? 0,
      stateAfter: updated.state ?? 0,
      easeFactorBefore: progress.easeFactor,
      intervalBeforeDays: progress.intervalDays ?? 0,
      intervalAfterDays: updated.intervalDays ?? 0,
      timeSpentMs,
    }).catch(() => {})

    // Update stats
    setSessionStats(prev => ({
      ...prev,
      studied: prev.studied + 1,
      correct: rating >= 3 ? prev.correct + 1 : prev.correct,
    }))

    // Next card or complete
    if (currentIdx < cards.length - 1) {
      setCurrentIdx(prev => prev + 1)
      setShowAnswer(false)
      setShowELI5(false)
      setShowMnemonic(false)
      setCardStartTime(Date.now())
    } else {
      // Session complete
      setComplete(true)
      const duration = Math.round((Date.now() - sessionStats.startTime) / 1000)
      await insertStudySession(user.id, {
        deckId,
        cardsStudied: sessionStats.studied + 1,
        correctCount: rating >= 3 ? sessionStats.correct + 1 : sessionStats.correct,
        duration,
      })
    }
  }, [currentCard, user, progress, currentIdx, cards.length, sessionStats, deckId, onProgressUpdate, cardStartTime])

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <span className="text-on-surface-variant text-sm">Loading cards...</span>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6">
        <span className="material-symbols-outlined text-outline-variant text-4xl mb-4">school</span>
        <p className="text-on-surface-variant">No cards in this deck yet.</p>
        <button onClick={() => navigate(-1)} className="text-primary font-medium mt-4">Go back</button>
      </div>
    )
  }

  // Completion screen
  if (complete) {
    const accuracy = sessionStats.studied > 0
      ? Math.round((sessionStats.correct / sessionStats.studied) * 100)
      : 0
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
        <h2 className="font-headline text-3xl font-extrabold mb-4">Session Complete</h2>
        <div className="flex gap-8 mb-8 text-center">
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
        <div className="flex gap-4">
          <button
            onClick={() => { setCurrentIdx(0); setComplete(false); setShowAnswer(false); setSessionStats({ studied: 0, correct: 0, startTime: Date.now() }) }}
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

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6">
      {/* Progress indicator */}
      <div className="w-full max-w-2xl mb-12">
        <div className="flex justify-between items-end mb-2">
          <span className="font-label text-[11px] uppercase tracking-widest text-on-surface-variant">
            Card {currentIdx + 1} of {cards.length}
          </span>
          {sessionStats.studied > 0 && (
            <span className="font-label text-[11px] uppercase tracking-widest text-primary font-bold">
              {Math.round((sessionStats.correct / sessionStats.studied) * 100)}% Accuracy
            </span>
          )}
        </div>
        <div className="h-[2px] w-full bg-surface-container overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((currentIdx + 1) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Flashcard */}
      <FlashCard
        card={currentCard}
        showExplanation={showELI5}
        showMnemonic={showMnemonic}
        onRequestELI5={() => setShowELI5(true)}
        onRequestMnemonic={() => setShowMnemonic(true)}
      />

      {/* Rating buttons — show after revealing answer */}
      {showAnswer && (
        <div className="animate-slide-up">
          <RatingButtons cardProgress={progress} onRate={handleRate} />
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
