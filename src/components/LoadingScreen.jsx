import { useState, useEffect, useRef } from 'react'

/**
 * Full-screen loading screen shown during flashcard generation.
 * Adapts progress steps and header based on source type / status updates.
 */

const STEPS = [
  { key: 'read', icon: 'description', label: 'Reading content...' },
  { key: 'think', icon: 'psychology', label: 'Claude is thinking...' },
  { key: 'generate', icon: 'style', label: 'Generating cards...' },
]

function resolveStep(status) {
  if (!status) return 'read'
  const s = status.toLowerCase()
  if (s.includes('generated') && s.includes('flashcards')) return 'done'
  if (s.includes('generating') || s.includes('cards')) return 'generate'
  if (s.includes('ai is') || s.includes('thinking') || s.includes('claude')) return 'think'
  return 'read'
}

export default function LoadingScreen({ source, sourceType, status, cardCount }) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const currentStep = resolveStep(status)
  const stepOrder = ['read', 'think', 'generate', 'done']
  const currentIdx = stepOrder.indexOf(currentStep)
  const progress = currentStep === 'done' ? 100 : Math.min(95, currentIdx * 30 + Math.min(elapsed * 1.5, 28))

  const sourceLabel = sourceType === 'interview' ? 'Interview Prep'
    : sourceType === 'youtube' ? 'YouTube Video'
    : sourceType === 'pdf' ? 'PDF Document'
    : sourceType === 'paste' ? 'Pasted Content'
    : source?.length > 50 ? source.slice(0, 50) + '...' : source

  return (
    <div className="fixed inset-0 z-40 bg-surface flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-6 py-16 flex flex-col items-center my-auto">

        {/* Header */}
        <div className="text-center mb-14 animate-fade-in">
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-surface mb-2">
            Generating: {sourceLabel}
          </h1>
          <p className="text-on-surface-variant font-medium">
            Distilling high-level concepts into focused study units.
          </p>
        </div>

        {/* Brain icon with pulsing glow */}
        <div className="relative flex items-center justify-center mb-16">
          <div className="absolute w-48 h-48 bg-primary/10 rounded-full loading-pulse-glow" />
          <div className="relative z-10 bg-surface-container-lowest p-8 rounded-full editorial-shadow">
            <span
              className="material-symbols-outlined text-primary text-6xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              psychology
            </span>
          </div>
        </div>

        {/* Progress steps */}
        <div className="w-full max-w-md bg-surface-container-low p-8 rounded-xl space-y-6 mb-16">
          {STEPS.map((step) => {
            const stepIdx = stepOrder.indexOf(step.key)
            const isDone = currentIdx > stepIdx
            const isActive = currentIdx === stepIdx
            const isPending = currentIdx < stepIdx

            return (
              <div key={step.key} className={`flex items-center justify-between ${isPending ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-4">
                  {isDone ? (
                    <span
                      className="material-symbols-outlined text-primary text-xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  ) : isActive ? (
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-on-surface-variant text-xl">pending</span>
                  )}
                  <span className={`font-medium ${isActive ? 'font-semibold text-on-surface' : isDone ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {status && isActive ? status : step.label}
                  </span>
                </div>
                {isActive && (
                  <span className="text-xs font-bold text-primary tracking-widest uppercase">Active</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Skeleton cards */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-xl editorial-shadow h-56 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="h-6 w-1/3 loading-shimmer rounded-lg" />
              <div className="h-4 w-full loading-shimmer rounded-lg" />
              <div className="h-4 w-5/6 loading-shimmer rounded-lg" />
            </div>
            <div className="flex justify-between items-end">
              <div className="h-10 w-24 loading-shimmer rounded-lg" />
              <div className="h-4 w-12 loading-shimmer rounded-lg" />
            </div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl h-56 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="h-6 w-1/2 loading-shimmer rounded-lg opacity-50" />
              <div className="h-4 w-full loading-shimmer rounded-lg opacity-50" />
              <div className="h-4 w-full loading-shimmer rounded-lg opacity-50" />
            </div>
            <div className="h-10 w-full loading-shimmer rounded-lg opacity-50" />
          </div>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8">
        <div className="bg-surface-container h-1.5 w-full rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <div className="flex justify-between mt-3">
          <span className="text-xs font-medium text-on-surface-variant tracking-wider">
            {Math.round(progress)}% processed
          </span>
          <span className="text-xs font-medium text-on-surface-variant tracking-wider">
            {elapsed}s elapsed
          </span>
        </div>
      </div>
    </div>
  )
}
