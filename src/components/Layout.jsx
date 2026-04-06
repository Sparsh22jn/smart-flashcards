import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../core/ThemeContext'

const NAV_ITEMS = [
  { to: '/', icon: 'home', iconFilled: 'home', label: 'Home' },
  { to: '/generate', icon: 'auto_awesome', iconFilled: 'auto_awesome', label: 'Create' },
  { to: '/library', icon: 'layers', iconFilled: 'layers', label: 'Library' },
  { to: '/progress', icon: 'insights', iconFilled: 'insights', label: 'Progress' },
  { to: '/settings', icon: 'person', iconFilled: 'person', label: 'Profile' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

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

          {/* Dark mode toggle — always visible */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
            aria-label="Toggle dark mode"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
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
    </div>
  )
}
