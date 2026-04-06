import { NavLink } from 'react-router-dom'
import { SOURCE_ICONS } from '../core/theme'

/**
 * Deck list item — based on Library.html Stitch design.
 * Minimalist: title, subtitle, progress bar, no borders.
 */
export default function DeckCard({ deck, progress }) {
  const pct = deck.cardCount > 0 && progress
    ? Math.round((progress.mastered / deck.cardCount) * 100)
    : 0

  return (
    <NavLink
      to={`/library/${deck.id}`}
      className="group cursor-pointer block"
    >
      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-on-surface-variant text-base">
              {SOURCE_ICONS[deck.sourceType] || 'layers'}
            </span>
            <h3 className="font-headline text-xl font-semibold text-on-surface group-hover:text-primary transition-colors">
              {deck.title}
            </h3>
          </div>
          <p className="text-on-surface-variant text-sm mt-1">
            {deck.cardCount} cards{deck.description ? ` · ${deck.description}` : ''}
          </p>
        </div>
        <span className="text-xs font-medium text-on-surface-variant tracking-widest uppercase">
          {pct}% Mastered
        </span>
      </div>
      {/* Subtle progress indicator */}
      <div className="h-[2px] w-full bg-surface-container overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-700 group-hover:bg-primary-dim"
          style={{ width: `${pct}%` }}
        />
      </div>
    </NavLink>
  )
}
