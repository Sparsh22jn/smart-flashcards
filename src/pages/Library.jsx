import { useNavigate } from 'react-router-dom'
import DeckCard from '../components/DeckCard'

/**
 * Library / Decks page — based on Library.html Stitch design.
 * "My Library — Curated collections for your daily practice."
 */
export default function Library({ decks, deckProgress }) {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-12 min-h-[80vh]">
      {/* Header */}
      <section className="mb-16 animate-fade-in">
        <h2 className="font-headline text-3xl font-extrabold text-on-surface mb-2">My Library</h2>
        <p className="text-on-surface-variant leading-relaxed text-lg">
          Curated collections for your daily practice.
        </p>
      </section>

      {/* Deck list */}
      {decks.length > 0 ? (
        <div className="space-y-16">
          {decks.map(deck => (
            <div key={deck.id} className="animate-slide-up">
              <DeckCard
                deck={deck}
                progress={deckProgress?.[deck.id]}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center mt-24">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-outline-variant">layers</span>
          </div>
          <p className="text-on-surface font-headline font-semibold mb-2">No decks yet</p>
          <p className="text-on-surface-variant text-sm text-center mb-8">
            Create your first deck by entering a topic or uploading a document.
          </p>
          <button
            onClick={() => navigate('/generate')}
            className="primary-gradient text-on-primary px-8 py-3 rounded-full font-bold editorial-shadow pressable"
          >
            Create First Deck
          </button>
        </div>
      )}

      {/* Quote — bottom decoration */}
      {decks.length > 0 && (
        <div className="mt-24 pt-16 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-outline-variant">layers</span>
          </div>
          <p className="text-on-surface-variant text-sm text-center italic">
            "The beautiful thing about learning is that no one can take it away from you."
          </p>
        </div>
      )}

      {/* FAB — Create new deck */}
      <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40">
        <button
          onClick={() => navigate('/generate')}
          className="w-14 h-14 primary-gradient text-on-primary rounded-full flex items-center justify-center editorial-shadow hover:scale-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </div>
  )
}
