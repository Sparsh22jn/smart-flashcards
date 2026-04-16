import { useState, useRef, useEffect } from 'react'
import {
  signUp, signIn, signInWithMagicLink, signInWithGoogle,
  sendPasswordReset, resendConfirmation,
} from '../lib/auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isValidEmail = (e) => EMAIL_RE.test(e.trim())

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

const ghostBtn =
  'w-full py-4 rounded-full ghost-border bg-surface-container-lowest text-on-surface ' +
  'font-semibold text-sm transition-all hover:bg-surface-container-low pressable ' +
  'disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2'

export default function AuthScreen({ onAuth }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [sentKind, setSentKind] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const focusRef = useRef(null)
  useEffect(() => {
    focusRef.current?.focus()
  }, [step])

  const resetMessages = () => setError(null)

  const goBackToEmail = () => {
    resetMessages()
    setStep('email')
    setPassword('')
    setShowPassword(false)
  }

  const handleEmailContinue = (e) => {
    e.preventDefault()
    resetMessages()
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setStep('password')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const data = await signIn(email, password)
      onAuth(data.user)
    } catch (err) {
      if (/email.*not.*confirmed/i.test(err.message)) {
        setError('Your email is not confirmed yet. Check your inbox, or resend the confirmation below.')
      } else if (/invalid.*credentials/i.test(err.message)) {
        setError('That password doesn\u2019t match. Try again or use a magic link.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    resetMessages()
    if (!termsAccepted) {
      setError('Please accept the Terms and Privacy Policy to continue.')
      return
    }
    if (scorePassword(password) < 2) {
      setError('Please choose a stronger password (8+ chars with a mix of letters & numbers).')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password, displayName.trim() || email.split('@')[0])
      setSentKind('signup')
      setStep('check-email')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    resetMessages()
    if (!isValidEmail(email)) {
      setError('Enter a valid email first.')
      return
    }
    setLoading(true)
    try {
      await signInWithMagicLink(email)
      setSentKind('magic')
      setStep('check-email')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    resetMessages()
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSentKind('reset')
      setStep('check-email')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    resetMessages()
    setLoading(true)
    try {
      await resendConfirmation(email)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    resetMessages()
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto bg-surface">
      <header className="w-full flex flex-col items-center mb-10 animate-fade-in">
        <div className="mb-6 w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-primary">
          <span
            className="material-symbols-outlined text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
        </div>
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface mb-2 text-center">
          Smart FlashCards
        </h1>
        <p className="font-body text-on-surface-variant text-sm tracking-tight text-center">
          AI-powered flashcards for smarter learning.
        </p>
      </header>

      <div key={step} className="w-full animate-slide-up">
        {step === 'email' && (
          <EmailStep
            email={email}
            setEmail={setEmail}
            onContinue={handleEmailContinue}
            onGoogle={handleGoogle}
            onSignupInstead={() => { resetMessages(); setStep('signup') }}
            loading={loading}
            error={error}
            inputRef={focusRef}
          />
        )}

        {step === 'password' && (
          <PasswordStep
            email={email}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            onLogin={handleLogin}
            onMagicLink={handleMagicLink}
            onForgot={() => { resetMessages(); setStep('forgot') }}
            onSignupInstead={() => { resetMessages(); setStep('signup') }}
            onBack={goBackToEmail}
            loading={loading}
            error={error}
            inputRef={focusRef}
          />
        )}

        {step === 'signup' && (
          <SignupStep
            email={email}
            setEmail={setEmail}
            displayName={displayName}
            setDisplayName={setDisplayName}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            termsAccepted={termsAccepted}
            setTermsAccepted={setTermsAccepted}
            onSignup={handleSignup}
            onLoginInstead={() => { resetMessages(); setStep('email') }}
            onBack={goBackToEmail}
            loading={loading}
            error={error}
            inputRef={focusRef}
          />
        )}

        {step === 'forgot' && (
          <ForgotStep
            email={email}
            setEmail={setEmail}
            onSubmit={handleForgot}
            onBack={() => { resetMessages(); setStep('password') }}
            loading={loading}
            error={error}
            inputRef={focusRef}
          />
        )}

        {step === 'check-email' && (
          <CheckEmailStep
            email={email}
            kind={sentKind}
            onBack={goBackToEmail}
            onResend={handleResendConfirmation}
            loading={loading}
            error={error}
          />
        )}
      </div>

      <div className="mt-12 text-on-surface-variant/40 text-[10px] tracking-widest font-bold uppercase">
        EST. 2024 · KNOWLEDGE PROTOCOL
      </div>
    </div>
  )
}

function ErrorBanner({ error }) {
  if (!error) return null
  return (
    <div role="alert" className="text-xs text-error bg-error-container/20 px-4 py-3 rounded-lg">
      {error}
    </div>
  )
}

function BackLink({ onClick, label = 'Back' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors mb-4"
    >
      <span className="material-symbols-outlined text-base">arrow_back</span>
      {label}
    </button>
  )
}

function PasswordVisibilityToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
      tabIndex={-1}
    >
      <span className="material-symbols-outlined text-xl">
        {visible ? 'visibility_off' : 'visibility'}
      </span>
    </button>
  )
}

function GoogleButton({ onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={ghostBtn}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1C29.1 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.7l6.2 5.1C41 35.6 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"/>
      </svg>
      Continue with Google
    </button>
  )
}

function EmailStep({ email, setEmail, onContinue, onGoogle, onSignupInstead, loading, error, inputRef }) {
  return (
    <>
      <div className="text-center mb-6">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Welcome</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Your knowledge sanctuary awaits.
        </p>
      </div>

      <GoogleButton onClick={onGoogle} disabled={loading} />

      <div className="flex items-center gap-4 my-5">
        <div className="flex-1 h-px bg-surface-container-high" />
        <span className="text-xs text-on-surface-variant">or continue with email</span>
        <div className="flex-1 h-px bg-surface-container-high" />
      </div>

      <form onSubmit={onContinue} className="space-y-3">
        <input
          ref={inputRef}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className={inputClass}
        />
        <ErrorBanner error={error} />
        <button
          type="submit"
          disabled={loading || !isValidEmail(email)}
          className={primaryBtn}
        >
          {loading ? '\u2026' : 'Continue'}
        </button>
      </form>

      <div className="text-center mt-6">
        <button
          type="button"
          onClick={onSignupInstead}
          className="text-primary font-medium text-sm hover:underline"
        >
          New to Smart FlashCards? Create an account
        </button>
      </div>
    </>
  )
}

function PasswordStep({
  email, password, setPassword, showPassword, setShowPassword,
  onLogin, onMagicLink, onForgot, onSignupInstead, onBack, loading, error, inputRef,
}) {
  return (
    <>
      <BackLink onClick={onBack} />
      <div className="text-center mb-6">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Enter your password</h2>
        <p className="text-on-surface-variant text-sm mt-1 truncate">
          Signing in as <span className="text-on-surface font-medium">{email}</span>
        </p>
      </div>

      <form onSubmit={onLogin} className="space-y-3">
        <div className="relative">
          <input
            ref={inputRef}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            required
            className={inputClass + ' pr-12'}
          />
          <PasswordVisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword(v => !v)}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgot}
            className="text-primary text-xs font-medium hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <ErrorBanner error={error} />

        <button
          type="submit"
          disabled={loading || password.length < 1}
          className={primaryBtn}
        >
          {loading ? '\u2026' : 'Log in'}
        </button>
      </form>

      <div className="flex items-center gap-4 my-4">
        <div className="flex-1 h-px bg-surface-container-high" />
        <span className="text-xs text-on-surface-variant">or</span>
        <div className="flex-1 h-px bg-surface-container-high" />
      </div>

      <button
        type="button"
        onClick={onMagicLink}
        disabled={loading}
        className={ghostBtn}
      >
        <span className="material-symbols-outlined text-lg">link</span>
        Email me a magic link
      </button>

      <div className="text-center mt-6">
        <button
          type="button"
          onClick={onSignupInstead}
          className="text-primary font-medium text-sm hover:underline"
        >
          Don’t have an account? Sign up
        </button>
      </div>
    </>
  )
}

function SignupStep({
  email, setEmail, displayName, setDisplayName, password, setPassword,
  showPassword, setShowPassword, termsAccepted, setTermsAccepted,
  onSignup, onLoginInstead, onBack, loading, error, inputRef,
}) {
  const score = scorePassword(password)
  return (
    <>
      <BackLink onClick={onBack} />
      <div className="text-center mb-6">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Create your account</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Start building your study library.
        </p>
      </div>

      <form onSubmit={onSignup} className="space-y-3">
        <input
          ref={inputRef}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          type="text"
          autoComplete="name"
          placeholder="Display name"
          className={inputClass}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className={inputClass}
        />
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Create a password"
            required
            minLength={8}
            className={inputClass + ' pr-12'}
          />
          <PasswordVisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword(v => !v)}
          />
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

        <label className="flex items-start gap-3 text-xs text-on-surface-variant pt-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-primary"
          />
          <span>
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        <ErrorBanner error={error} />

        <button
          type="submit"
          disabled={loading || !isValidEmail(email) || score < 2 || !termsAccepted}
          className={primaryBtn + ' mt-2'}
        >
          {loading ? '\u2026' : 'Create account'}
        </button>
      </form>

      <div className="text-center mt-6">
        <button
          type="button"
          onClick={onLoginInstead}
          className="text-primary font-medium text-sm hover:underline"
        >
          Already have an account? Log in
        </button>
      </div>
    </>
  )
}

function ForgotStep({ email, setEmail, onSubmit, onBack, loading, error, inputRef }) {
  return (
    <>
      <BackLink onClick={onBack} />
      <div className="text-center mb-6">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Reset your password</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Enter your email and we’ll send you a reset link.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          ref={inputRef}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className={inputClass}
        />
        <ErrorBanner error={error} />
        <button
          type="submit"
          disabled={loading || !isValidEmail(email)}
          className={primaryBtn}
        >
          {loading ? '\u2026' : 'Send reset link'}
        </button>
      </form>
    </>
  )
}

function CheckEmailStep({ email, kind, onBack, onResend, loading, error }) {
  const copy = {
    signup: {
      title: 'Confirm your email',
      body: `We sent a confirmation link to ${email}. Click it to activate your account.`,
    },
    magic: {
      title: 'Check your inbox',
      body: `We sent a magic sign-in link to ${email}. Click it to log in.`,
    },
    reset: {
      title: 'Check your inbox',
      body: `If an account exists for ${email}, we sent a password reset link. It expires in 1 hour.`,
    },
  }[kind] || { title: 'Check your inbox', body: `Email sent to ${email}.` }

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-primary">
        <span
          className="material-symbols-outlined text-4xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          mark_email_read
        </span>
      </div>
      <h2 className="font-headline text-2xl font-bold text-on-surface">{copy.title}</h2>
      <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">{copy.body}</p>

      {error && (
        <div className="mt-4">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="mt-8 space-y-3">
        {kind === 'signup' && (
          <button
            type="button"
            onClick={onResend}
            disabled={loading}
            className={ghostBtn}
          >
            {loading ? 'Sending\u2026' : 'Resend confirmation email'}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="text-primary font-medium text-sm hover:underline"
        >
          Use a different email
        </button>
      </div>
    </div>
  )
}
