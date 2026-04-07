import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useGeneration } from '../contexts/GenerationContext'

const NAV_ITEMS = [
  { to: '/', icon: 'home', iconFilled: 'home', label: 'Home' },
  { to: '/generate', icon: 'auto_awesome', iconFilled: 'auto_awesome', label: 'Create' },
  { to: '/library', icon: 'layers', iconFilled: 'layers', label: 'Library' },
  { to: '/progress', icon: 'insights', iconFilled: 'insights', label: 'Progress' },
  { to: '/settings', icon: 'person', iconFilled: 'person', label: 'Profile' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { generating, generatedCards, status, reset } = useGeneration()
  const isOnGeneratePage = location.pathname === '/generate'
  const showBanner = !isOnGeneratePage && (generating || generatedCards.length > 0)

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top App Bar — Glassmorphic */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl">
        <nav className="flex justify-between items-center px-6 py-4 max-w-5xl mx-auto">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg primary-gradient flex items-center justify-center">
              <span
                className="material-symbols-outlined text-on-primary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                psychology
              </span>
            </div>
            <span className="text-lg font-bold tracking-tight text-on-surface font-headline">
              Smart FlashCards
            </span>
          </NavLink>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-on-surface-variant">
            {NAV_ITEMS.slice(1).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `hover:text-primary transition-colors ${isActive ? 'text-primary font-semibold' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-20 pb-24 md:pb-8">
        {children}
      </main>

      {/* Bottom Nav Bar — Mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-xl editorial-shadow">
        <div className="flex justify-around items-center px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to))

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'text-primary font-bold bg-primary/5'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span
                  className="material-symbols-outlined mb-0.5"
                  style={{
                    fontSize: 24,
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {isActive ? item.iconFilled : item.icon}
                </span>
                <span className="text-[10px] uppercase tracking-widest font-medium">
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Generation-in-progress floating banner */}
      {showBanner && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up flex items-center gap-2">
          <button
            onClick={() => navigate('/generate')}
            className="bg-primary text-on-primary px-6 py-3 rounded-full
                       editorial-shadow flex items-center gap-3 font-medium text-sm
                       pressable hover:scale-105 transition-transform"
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                <span>{status || 'Generating cards...'}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span>{generatedCards.length} cards ready! Tap to view</span>
              </>
            )}
          </button>
          {!generating && (
            <button
              onClick={reset}
              className="bg-surface-container text-on-surface-variant w-9 h-9 rounded-full
                         flex items-center justify-center editorial-shadow
                         hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
