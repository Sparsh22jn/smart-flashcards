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

        {/* Budget / Cost */}
        <div className="group">
          <div className="space-y-1">
            <div className="w-full flex justify-between items-center py-4 px-4 rounded-xl">
              <span className="font-headline text-2xl font-semibold tracking-tight text-on-surface">Budget</span>
              <span className="text-primary font-headline font-bold">
                ${costTracker?.total_cost?.toFixed(2) || '0.00'}
              </span>
            </div>
            <div className="px-4 text-on-surface-variant text-sm">
              Total spent on AI generation. Billed directly to your Anthropic account.
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
