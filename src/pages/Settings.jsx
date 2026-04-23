import { signOut } from '../lib/auth'

/**
 * Settings page — based on Settings.html Stitch design.
 * Large editorial typography, quiet layout.
 */
export default function Settings({ user, costTracker }) {
  return (
    <div className="max-w-xl mx-auto px-6 pt-8 pb-12 min-h-[80vh]">
      {/* Header */}
      <section className="mb-20 text-center animate-fade-in">
        <h2 className="font-headline text-[3rem] font-extrabold tracking-tight leading-tight mb-4 text-on-surface">
          Settings
        </h2>
        <p className="text-on-surface-variant font-body text-lg max-w-md mx-auto leading-relaxed">
          Configure your environment and manage your preferences.
        </p>
      </section>

      {/* Settings list */}
      <div className="space-y-12 animate-slide-up">
        {/* Account */}
        <div className="group">
          <div className="space-y-1">
            <div className="w-full flex justify-between items-center py-4 px-4 rounded-xl">
              <span className="font-headline text-2xl font-semibold tracking-tight text-on-surface">Account</span>
            </div>
            <div className="px-4 text-on-surface-variant text-sm">
              {user?.email}
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="group">
          <div className="space-y-1">
            <div className="w-full flex justify-between items-center py-4 px-4 rounded-xl">
              <span className="font-headline text-2xl font-semibold tracking-tight text-on-surface">Usage</span>
              <span className="text-primary font-headline font-bold">
                {costTracker?.total_input_tokens || costTracker?.total_output_tokens
                  ? `${((costTracker.total_input_tokens || 0) + (costTracker.total_output_tokens || 0)).toLocaleString()} tokens`
                  : 'No usage yet'}
              </span>
            </div>
            <div className="px-4 text-on-surface-variant text-sm">
              Total AI usage for your account. All features are free during the beta.
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="group">
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-4 px-4 rounded-xl transition-all duration-300 hover:bg-surface-container-high active:scale-[0.98]">
              <span className="font-headline text-2xl font-semibold tracking-tight text-on-surface">Appearance</span>
              <span className="material-symbols-outlined text-on-surface-variant/30">chevron_right</span>
            </button>
            <div className="px-4 text-on-surface-variant text-sm">
              Theme and display preferences. Coming soon.
            </div>
          </div>
        </div>

        {/* Import / Export */}
        <div className="group">
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-4 px-4 rounded-xl transition-all duration-300 hover:bg-surface-container-high active:scale-[0.98]">
              <span className="font-headline text-2xl font-semibold tracking-tight text-on-surface">Import & Export</span>
              <span className="material-symbols-outlined text-on-surface-variant/30">chevron_right</span>
            </button>
            <div className="px-4 text-on-surface-variant text-sm">
              Move your knowledge between platforms. CSV, Anki, JSON.
            </div>
          </div>
        </div>

        {/* About */}
        <div className="group">
          <div className="space-y-1">
            <div className="w-full flex justify-between items-center py-4 px-4 rounded-xl">
              <span className="font-headline text-2xl font-semibold tracking-tight text-on-surface">About</span>
              <span className="text-on-surface-variant font-body text-sm">v1.0.0</span>
            </div>
            <div className="px-4 text-on-surface-variant text-sm space-y-3">
              <p>
                Smart FlashCards turns any topic, PDF, pasted text, or YouTube video into
                exam-grade flashcards with spaced repetition, so studying feels like progress
                instead of guesswork.
              </p>
              <p>
                Built with React, Vite, Tailwind, and Supabase. AI generation runs on Claude
                via Supabase Edge Functions.
              </p>
              <p>
                <a
                  href="https://github.com/Sparsh22jn/smart-flashcards"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:opacity-80 transition-opacity"
                >
                  View source on GitHub →
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Destructive actions */}
        <div className="pt-12 mt-12">
          <div className="bg-surface-container-low rounded-2xl p-8 text-center space-y-4">
            <button
              onClick={() => signOut()}
              className="text-on-surface-variant font-headline font-semibold text-lg hover:opacity-80 transition-opacity active:scale-95 px-8 py-3"
            >
              Sign Out
            </button>
            <p className="text-on-surface-variant font-body text-sm px-8">
              Your data is securely stored and will be here when you return.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
