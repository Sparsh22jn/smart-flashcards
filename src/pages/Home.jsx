import { useNavigate } from 'react-router-dom'

/**
 * Home / Dashboard — based on Welcome.html + Quiet_Entry.html Stitch designs.
 * The "What would you like to learn today?" screen.
 */
export default function Home({ user, decks, studySessions }) {
  const navigate = useNavigate()
  const firstName = user?.user_metadata?.display_name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  // Quick stats
  const totalCards = decks.reduce((sum, d) => sum + (d.cardCount || 0), 0)
  const recentSessions = studySessions.filter(s => {
    const d = new Date(s.created_at)
    const week = new Date(); week.setDate(week.getDate() - 7)
    return d > week
  })
  const weeklyCards = recentSessions.reduce((sum, s) => sum + (s.cards_studied || 0), 0)

  const SUGGESTIONS = ['Spanish verbs', 'Python basics', 'Kubernetes architecture', 'Organic Chemistry', 'Jazz Theory']

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 max-w-4xl mx-auto">
      {/* Welcome */}
      <div className="text-center mb-12 animate-fade-in">
        <p className="text-on-surface-variant text-sm mb-3">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </p>
        <h1 className="font-headline font-extrabold text-4xl md:text-5xl lg:text-6xl text-on-surface tracking-tight mb-8 leading-[1.1]">
          What would you like <br />to learn today?
        </h1>

        {/* Quick stats */}
        {totalCards > 0 && (
          <div className="flex justify-center gap-8 mb-8 text-sm text-on-surface-variant">
            <span>{decks.length} decks</span>
            <span>{totalCards} cards</span>
            {weeklyCards > 0 && <span>{weeklyCards} studied this week</span>}
          </div>
        )}

        {/* Suggestion pills */}
        <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
          {SUGGESTIONS.map(topic => (
            <button
              key={topic}
              onClick={() => navigate('/generate', { state: { topic } })}
              className="px-5 py-2 rounded-full bg-surface-container-low text-on-surface-variant font-label text-sm hover:bg-surface-container-high transition-all pressable"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar — fixed at bottom on mobile, inline on desktop */}
      <div className="w-full max-w-3xl fixed bottom-24 md:relative md:bottom-auto left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto px-6 md:px-0">
        <div
          className="relative group bg-surface-container-lowest editorial-shadow rounded-full p-2 flex items-center transition-all focus-within:ring-1 focus-within:ring-outline-variant/20 cursor-pointer"
          onClick={() => navigate('/generate')}
        >
          <div className="flex items-center gap-1 pl-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant">
              <span className="material-symbols-outlined">smart_display</span>
            </div>
          </div>
          <span className="flex-1 text-on-surface-variant/60 font-body px-4 py-3 text-lg">
            Paste a topic, link, or upload a file...
          </span>
          <div className="w-12 h-12 flex items-center justify-center rounded-full primary-gradient text-white editorial-shadow">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 600" }}>
              arrow_upward
            </span>
          </div>
        </div>
        <p className="text-center text-on-surface-variant/40 text-[10px] mt-3 font-body tracking-wider uppercase">
          An intellectual sanctuary for focused learning.
        </p>
      </div>
    </div>
  )
}
