import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { updatePassword } from '../lib/auth'

function scorePassword(pw) {
  if (!pw || pw.length < 6) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = [
  'bg-error',
  'bg-error-container',
  'bg-outline-variant',
  'bg-tertiary',
  'bg-primary',
]

const inputClass =
  'w-full px-5 py-4 bg-surface-container-low border-none rounded-xl text-on-surface ' +
  'placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/25 ' +
  'focus:bg-surface-container-lowest transition-all'

const primaryBtn =
  'w-full py-4 primary-gradient text-on-primary rounded-full font-headline font-bold ' +
  'text-base editorial-shadow transition-transform active:scale-[0.98] disabled:opacity-50 ' +
  'disabled:cursor-not-allowed'

export default function ResetPassword() {
  const [status, setStatus] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let settled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        settled = true
        setStatus('ready')
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return
      if (session) setStatus('ready')
      else {
        setTimeout(() => {
          if (!settled) setStatus('invalid')
        }, 1500)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const score = scorePassword(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (score < 2) {
      setError('Please choose a stronger password (8+ chars with a mix of letters & numbers).')
      return
    }
    if (password !== confirm) {
      setError('Passwords don’t match.')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      setStatus('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto bg-surface">
      <div className="w-full animate-slide-up">
        {status === 'checking' && (
          <div className="text-center text-on-surface-variant text-sm">Verifying link…</div>
        )}

        {status === 'invalid' && (
          <div className="text-center">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-error-container/30 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-4xl">link_off</span>
            </div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              Reset link expired
            </h1>
            <p className="text-on-surface-variant text-sm mt-2">
              This password reset link is invalid or has already been used.
            </p>
            <a
              href="/"
              className="inline-block mt-6 text-primary font-medium text-sm hover:underline"
            >
              Back to sign in
            </a>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-primary">
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lock_reset
                </span>
              </div>
              <h1 className="font-headline text-2xl font-bold text-on-surface">
                Set a new password
              </h1>
              <p className="text-on-surface-variant text-sm mt-2">
                Choose a strong password you haven’t used before.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="New password"
                  required
                  minLength={8}
                  autoFocus
                  className={inputClass + ' pr-12'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {password && (
                <div className="px-1">
                  <div className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-colors ${
                          i < score ? STRENGTH_COLORS[score] : 'bg-surface-container-high'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-on-surface-variant">
                    Strength: <span className="text-on-surface font-medium">{STRENGTH_LABELS[score]}</span>
                  </div>
                </div>
              )}

              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirm new password"
                required
                minLength={8}
                className={inputClass}
              />

              {error && (
                <div role="alert" className="text-xs text-error bg-error-container/20 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || score < 2 || password !== confirm}
                className={primaryBtn + ' mt-2'}
              >
                {loading ? '…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        {status === 'done' && (
          <div className="text-center">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-primary">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              Password updated
            </h1>
            <p className="text-on-surface-variant text-sm mt-2">
              You’re all set. Redirecting you now…
            </p>
            <a
              href="/"
              className="inline-block mt-6 text-primary font-medium text-sm hover:underline"
            >
              Continue
            </a>
            <AutoRedirect />
          </div>
        )}
      </div>
    </div>
  )
}

function AutoRedirect() {
  useEffect(() => {
    const t = setTimeout(() => { window.location.href = '/' }, 1500)
    return () => clearTimeout(t)
  }, [])
  return null
}
