import { RATING } from '../core/theme'
import { previewIntervals, intervalLabel } from '../core/fsrs'

/**
 * Spaced repetition rating interface.
 * Based on Study.html Stitch design — 4-button rating grid.
 */
export default function RatingButtons({ cardProgress, onRate, deckSettings }) {
  const previews = previewIntervals(cardProgress, deckSettings)

  const buttons = [
    { rating: 1, interval: previews.again },
    { rating: 2, interval: previews.hard },
    { rating: 3, interval: previews.good },
    { rating: 4, interval: previews.easy },
  ]

  return (
    <div className="w-full max-w-md mx-auto mt-12">
      <div className="grid grid-cols-4 gap-3">
        {buttons.map(({ rating, interval }) => {
          const r = RATING[rating]
          return (
            <button
              key={rating}
              onClick={() => onRate(rating)}
              className="group flex flex-col items-center gap-2 py-4 rounded-xl hover:bg-surface-container-low transition-all pressable"
            >
              <div
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors"
                style={{
                  borderColor: 'rgba(172, 179, 182, 0.2)',
                }}
              >
                <span
                  className="font-headline font-bold text-xs transition-colors group-hover:opacity-100"
                  style={{ color: r.color }}
                >
                  {rating}
                </span>
              </div>
              <span
                className="font-label text-[10px] uppercase tracking-tighter transition-colors"
                style={{ color: r.color }}
              >
                {r.label}
              </span>
              <span className="text-[9px] text-on-surface-variant opacity-60">
                {intervalLabel(interval)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
