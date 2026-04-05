import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCards, deleteCard, deleteDeck, updateCard } from '../lib/data'

/**
 * Deck detail — view all cards in a deck, edit, delete, start study.
 * Based on Editor.html Stitch design.
 */
export default function DeckDetail({ user, onRefresh }) {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  useEffect(() => {
    if (!deckId) return
    setLoading(true)
    fetchCards(deckId)
      .then(c => setCards(c))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [deckId])

  const handleDelete = async (cardId) => {
    await deleteCard(cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
  }

  const handleDeleteDeck = async () => {
    if (!confirm('Delete this entire deck? This cannot be undone.')) return
    await deleteDeck(deckId)
    onRefresh?.()
    navigate('/library')
  }

  const handleEdit = (card) => {
    setEditingId(card.id)
    setEditFront(card.front)
    setEditBack(card.back)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const updated = await updateCard(editingId, { front: editFront, back: editBack })
    setCards(prev => prev.map(c => c.id === editingId ? { ...c, ...updated } : c))
    setEditingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <span className="text-on-surface-variant text-sm">Loading deck...</span>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start mb-12 animate-fade-in">
        <div>
          <button onClick={() => navigate('/library')} className="text-on-surface-variant text-sm flex items-center gap-1 mb-4 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Library
          </button>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
            {cards.length} Cards
          </h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDeleteDeck}
            className="text-on-surface-variant hover:text-error transition-colors px-3 py-2 text-sm font-medium"
          >
            Delete Deck
          </button>
          <button
            onClick={() => navigate(`/study/${deckId}`)}
            className="primary-gradient text-on-primary px-6 py-2.5 rounded-full font-bold text-sm editorial-shadow pressable"
          >
            Study Now
          </button>
        </div>
      </div>

      {/* Card list */}
      <div className="space-y-8">
        {cards.map((card, i) => (
          <div key={card.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
            {editingId === card.id ? (
              /* Edit mode */
              <div className="space-y-4">
                <div>
                  <label className="font-headline text-sm uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
                    Question
                  </label>
                  <textarea
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    className="w-full min-h-[100px] bg-surface-container-low border-none focus:ring-0 focus:bg-surface-container-lowest transition-all p-6 text-lg font-headline leading-tight tracking-tight rounded-xl editorial-shadow"
                  />
                </div>
                <div>
                  <label className="font-headline text-sm uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
                    Answer
                  </label>
                  <textarea
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    className="w-full min-h-[120px] bg-surface-container-low border-none focus:ring-0 focus:bg-surface-container-lowest transition-all p-6 text-base font-body leading-relaxed rounded-xl editorial-shadow"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setEditingId(null)} className="text-on-surface-variant px-4 py-2 text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="primary-gradient text-on-primary px-6 py-2.5 rounded-full font-bold text-sm editorial-shadow pressable"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="group">
                <div className="flex items-start gap-4">
                  <span className="text-2xl font-headline font-black text-outline-variant/20 mt-1">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-semibold text-on-surface mb-2">{card.front}</p>
                    <p className="text-on-surface-variant text-sm leading-relaxed">{card.back}</p>
                    {card.explanation && (
                      <div className="mt-3 pt-3 border-t border-outline-variant/10">
                        <span className="text-[10px] uppercase tracking-widest text-primary font-bold">ELI5</span>
                        <p className="text-on-surface-variant text-xs mt-1">{card.explanation}</p>
                      </div>
                    )}
                  </div>
                  {/* Actions — visible on hover */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(card)}
                      className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-low"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-full hover:bg-surface-container-low"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
