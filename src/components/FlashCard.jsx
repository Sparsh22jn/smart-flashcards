import { useState } from 'react'

/**
 * Flashcard with flip animation — the hero interaction.
 * Based on Study.html Stitch design.
 */
export default function FlashCard({ card, showExplanation, showMnemonic, onRequestELI5, onRequestMnemonic }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Card flip container */}
      <div
        className="flip-container w-full cursor-pointer"
        style={{ minHeight: 320 }}
        onClick={() => setFlipped(!flipped)}
      >
        <div className={`flip-card relative w-full ${flipped ? 'flipped' : ''}`} style={{ minHeight: 320 }}>
          {/* Front — Question */}
          <div className="flip-front w-full py-16 md:py-24 flex flex-col items-center text-center">
            <span className="font-label text-[11px] uppercase tracking-widest text-on-surface-variant mb-8 block">
              {card.difficulty === 'hard' ? 'Advanced Concept' : card.difficulty === 'easy' ? 'Fundamental' : 'Core Concept'}
            </span>
            <h2 className="font-headline text-2xl md:text-4xl font-extrabold tracking-tight leading-tight max-w-xl text-on-surface px-4">
              {card.front}
            </h2>
            <div className="mt-12">
              <button className="group flex flex-col items-center gap-3 transition-all">
                <span className="text-on-surface-variant font-body text-sm tracking-wide opacity-60 group-hover:opacity-100 transition-opacity">
                  Tap to reveal the answer
                </span>
                <div className="p-3 rounded-full bg-surface-container-low group-hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-primary">visibility</span>
                </div>
              </button>
            </div>
          </div>

          {/* Back — Answer */}
          <div className="flip-back w-full py-12 flex flex-col items-center text-center">
            <div className="max-w-2xl px-4">
              <span className="font-label text-[11px] uppercase tracking-widest text-primary mb-6 block font-bold">
                Answer
              </span>
              <p className="font-body text-lg md:text-xl leading-relaxed text-on-surface-variant">
                {card.back}
              </p>

              {/* ELI5 / Mnemonic section */}
              {(showExplanation || showMnemonic) && (
                <div className="mt-8 pt-8 border-t border-outline-variant/10 space-y-6">
                  {showExplanation && card.explanation && (
                    <div className="bg-surface-container-low rounded-xl p-6 text-left">
                      <span className="text-[10px] uppercase tracking-widest text-primary font-bold mb-2 block">
                        Explained Simply
                      </span>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{card.explanation}</p>
                    </div>
                  )}
                  {showMnemonic && card.mnemonic && (
                    <div className="bg-surface-container-low rounded-xl p-6 text-left">
                      <span className="text-[10px] uppercase tracking-widest text-tertiary font-bold mb-2 block">
                        Memory Trick
                      </span>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{card.mnemonic}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-center gap-8 mt-8">
                <button
                  onClick={(e) => { e.stopPropagation(); onRequestELI5?.() }}
                  className="font-label text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">lightbulb</span>
                  ELI5
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRequestMnemonic?.() }}
                  className="font-label text-[11px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">psychology</span>
                  Mnemonic
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
