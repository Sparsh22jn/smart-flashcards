import { useState } from 'react'
import { signUp, signIn, signInWithMagicLink, signInWithGoogle } from '../lib/auth'

/**
 * Auth screen — based on Welcome2.html + API_Key_Setup.html Stitch designs.
 * Quiet Editorial aesthetic.
 */
export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSuccess(null); setLoading(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName || email.split('@')[0])
        setSuccess('Check your email to confirm your account, then log in.')
        setMode('login')
      } else {
        const data = await signIn(email, password)
        onAuth(data.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) { setError('Enter your email first'); return }
    setError(null); setSuccess(null); setLoading(true)
    try {
      await signInWithMagicLink(email)
      setSuccess('Magic link sent! Check your email.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 max-w-xl mx-auto bg-surface">
      {/* Logo & branding */}
      <header className="w-full flex flex-col items-center mb-16 animate-fade-in">
        <div className="mb-6 w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-primary">
          <span
            className="material-symbols-outlined text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
        </div>
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface mb-3">
          Smart FlashCards
        </h1>
        <p className="font-body text-on-surface-variant text-lg tracking-tight">
          AI-powered flashcards for smarter learning.
        </p>
      </header>

      {/* Auth form */}
      <div className="w-full animate-slide-up">
        <div className="text-center mb-8">
          <h2 className="font-headline text-2xl font-bold text-on-surface">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-on-surface-variant text-sm mt-2">
            {mode === 'login'
              ? 'Your knowledge sanctuary awaits.'
              : 'Start building your study library.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full px-5 py-4 bg-surface-container-low border-none rounded-xl text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            required
            className="w-full px-5 py-4 bg-surface-container-low border-none rounded-xl text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password (min 6 characters)"
            required
            minLength={6}
            className="w-full px-5 py-4 bg-surface-container-low border-none rounded-xl text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
          />

          {error && (
            <div className="text-xs text-error bg-error-container/20 px-4 py-3 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="text-xs text-primary bg-primary-container/20 px-4 py-3 rounded-lg">{success}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 primary-gradient text-on-primary rounded-full font-headline font-bold text-base editorial-shadow transition-transform active:scale-[0.98] disabled:opacity-60 mt-2"
          >
            {loading ? '...' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-surface-container-high" />
              <span className="text-xs text-on-surface-variant">or</span>
              <div className="flex-1 h-px bg-surface-container-high" />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleMagicLink}
                disabled={loading}
                className="w-full py-4 rounded-full ghost-border bg-surface-container-lowest text-on-surface font-semibold text-sm transition-all hover:bg-surface-container-low pressable"
              >
                Sign in with Magic Link
              </button>
              <button
                onClick={() => signInWithGoogle()}
                disabled={loading}
                className="w-full py-4 rounded-full ghost-border bg-surface-container-lowest text-on-surface font-semibold text-sm transition-all hover:bg-surface-container-low pressable"
              >
                Continue with Google
              </button>
            </div>
          </>
        )}

        <div className="text-center mt-6">
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setSuccess(null) }}
            className="text-primary font-medium text-sm hover:underline"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </div>

      <div className="mt-12 text-on-surface-variant/40 text-[10px] tracking-widest font-bold uppercase">
        EST. 2024 · KNOWLEDGE PROTOCOL
      </div>
    </div>
  )
}
