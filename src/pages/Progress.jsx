/**
 * Progress / Analytics page — based on Progress.html Stitch design.
 * Bento grid with retention, streaks, study time, and discipline breakdown.
 */
export default function Progress({ studySessions, decks, streak }) {
  // Calculate stats
  const now = new Date()
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)

  const weeklySessions = studySessions.filter(s => new Date(s.created_at) > weekAgo)
  const monthlySessions = studySessions.filter(s => new Date(s.created_at) > monthAgo)

  const totalCardsStudied = monthlySessions.reduce((sum, s) => sum + (s.cards_studied || 0), 0)
  const totalCorrect = monthlySessions.reduce((sum, s) => sum + (s.correct_count || 0), 0)
  const retention = totalCardsStudied > 0 ? Math.round((totalCorrect / totalCardsStudied) * 100) : 0

  const totalSeconds = weeklySessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
  const hoursStudied = (totalSeconds / 3600).toFixed(1)

  // Streak — prefer DB value, fall back to computing from sessions
  const daySet = new Set()
  weeklySessions.forEach(s => {
    daySet.add(new Date(s.created_at).toISOString().slice(0, 10))
  })
  const streakDays = streak?.current_streak ?? daySet.size

  // Day dots for streak visualization
  const dayDots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return daySet.has(d.toISOString().slice(0, 10))
  })

  return (
    <div className="max-w-4xl mx-auto px-6 pt-8 pb-12">
      {/* Header */}
      <section className="mb-16 animate-fade-in">
        <p className="text-on-surface-variant font-medium tracking-widest uppercase text-xs mb-4">
          Performance Overview
        </p>
        <h2 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-8">
          Your focus is <span className="text-primary">evolving</span>.
        </h2>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Retention card — large */}
          <div className="md:col-span-2 p-8 rounded-2xl bg-surface-container-lowest editorial-shadow">
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-on-surface-variant text-sm mb-1">Knowledge Retention</p>
                <h3 className="text-5xl font-headline font-bold text-on-surface">{retention}%</h3>
              </div>
              <div className="bg-primary-container/20 p-3 rounded-full">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  insights
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                <span>Deep Recall</span>
                <span>{retention >= 80 ? 'Optimal' : retention >= 60 ? 'Good' : 'Needs Focus'}</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${retention}%` }} />
              </div>
            </div>
          </div>

          {/* Streak card — small */}
          <div className="p-8 rounded-2xl bg-surface-container-low">
            <p className="text-on-surface-variant text-sm mb-1">Weekly Streak</p>
            <h3 className="text-5xl font-headline font-bold text-on-surface mb-8">
              {streakDays}-day
            </h3>
            <div className="flex gap-2">
              {dayDots.map((active, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-primary' : 'bg-outline-variant/30'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Study time section */}
      <section className="space-y-16 animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div className="max-w-md">
            <h4 className="font-headline text-2xl font-bold mb-4">{hoursStudied} hours studied</h4>
            <p className="text-on-surface-variant leading-relaxed text-lg">
              {totalCardsStudied > 0
                ? `You've reviewed ${totalCardsStudied} cards across ${monthlySessions.length} sessions this month.`
                : 'Start studying to see your progress here.'}
            </p>
          </div>
        </div>

        {/* Deck performance list */}
        {decks.length > 0 && (
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em] block mb-6">
              Deck Performance
            </span>
            <div className="space-y-8">
              {decks.slice(0, 5).map(deck => (
                <div key={deck.id} className="group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-headline font-bold text-on-surface">{deck.title}</span>
                    <span className="text-sm font-medium text-on-surface-variant">
                      {deck.cardCount} cards
                    </span>
                  </div>
                  <div className="h-px w-full bg-surface-container group-hover:bg-primary/20 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mt-32 mb-16 text-center max-w-xl mx-auto">
        <span className="material-symbols-outlined text-primary-dim text-4xl mb-6 block">auto_awesome</span>
        <h5 className="font-headline text-xl font-bold mb-4">Ready for the next leap?</h5>
        <p className="text-on-surface-variant mb-12">
          Consistent daily review is the key to long-term retention.
        </p>
        <div className="h-px w-24 bg-surface-container-high mx-auto" />
      </section>
    </div>
  )
}
