# Smart FlashCards — Changelog

## 2026-04-06: Professional Prompt, Smart Card Counts, YouTube Retry, Loading Screen & UI Fixes

### Features

#### 1. Professional-Grade System Prompt
- Replaced generic educator prompt with one targeting USMLE, bar exam, board certification depth
- **Domain detection**: medical, legal, scientific, humanities, technical — each gets adapted question styles
- **Difficulty tiers**: Easy (definitions), Medium (application/vignettes), Hard/Advanced (synthesis, edge cases, exam-style)
- Cards are now "atomic but deep" — one concept per card, explored thoroughly
- Questions must be specific and testable; answers must include reasoning/mechanism
- Professional-grade mnemonics using varied techniques

#### 2. Smart Card Counts (Auto-Calculated from Difficulty)
- Removed manual 5/10/15/20 card count picker
- Card count is now auto-calculated based on difficulty + source type:
  - **Topic**: Easy=10, Medium=25, Advanced=50
  - **Paste/PDF/YouTube**: scales with content word count
    - Easy: ~1 card per 100 words (min 5, max 20)
    - Medium: ~1 card per 50 words (min 10, max 40)
    - Advanced: medium count + 15 extra cards (goes beyond source material)
- Estimated count shown as "~25 cards" label next to difficulty selector
- Difficulty labels renamed: easy → Easy, medium → Medium, hard → Advanced

#### 3. YouTube 429 Retry Logic
- Added `fetchWithRetry` helper with exponential backoff (1s → 2s → 4s + jitter)
- Retries up to 3 times on HTTP 429 (rate limit) and 5xx (server error)
- User-friendly error message on persistent 429: "YouTube is rate-limiting requests. Please wait a minute and try again, or paste the video transcript directly."
- Applied to all 3 YouTube fetch calls: `fetchPlayerResponse`, `fetchCaptionTrack`, `fetchCaptionTrackXML`

#### 4. Loading Screen
- Full-screen loading overlay during flashcard generation (before cards arrive)
- Header: "Generating: [source name]" with contextual subtitle
- Pulsing brain icon with animated glow ring
- 3-step progress checklist driven by real SSE status messages:
  - Reading content → Claude is thinking → Generating cards
  - Each step shows checkmark (done), spinner (active), or pending icon
- Shimmer skeleton card placeholders (bento grid layout)
- Bottom progress bar with percentage + elapsed time counter

### Bug Fixes

#### 5. UI/UX Visual Fixes
- **Loading screen header no longer clipped**: Fixed CSS flexbox overflow issue where `justify-center` caused the header to overflow above the viewport. Replaced with child auto-margins (`my-auto`) pattern.
- **Card flip synced with "Show Answer"**: Previously, clicking "Show Answer" revealed rating buttons but the card stayed on the question side. Now the FlashCard flip state is controlled by the parent Study component — clicking "Show Answer" both flips the card and shows rating buttons. Clicking the card directly also toggles both states. Card state resets cleanly when advancing to the next card via `key={currentCard.id}`.
- **Estimated card count always visible**: The "~25 cards" label now shows immediately on the Generate page (defaulting to topic-based estimate) instead of only appearing after generation.

### Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/generate/index.ts` | New system prompt + upgraded user message templates for all 3 source types |
| `supabase/functions/generate/youtube.ts` | Added `fetchWithRetry` with exponential backoff, wired into 3 fetch sites |
| `src/pages/Generate.jsx` | Removed card count picker, auto-calculate from difficulty, always show estimate |
| `src/components/LoadingScreen.jsx` | New component: full-screen loading with progress steps, skeleton cards, progress bar |
| `src/components/FlashCard.jsx` | Accept controlled `flipped`/`onFlip` props from parent |
| `src/pages/Study.jsx` | Pass `flipped={showAnswer}` and `onFlip` to FlashCard, add `key` for clean remount |
| `src/app.css` | Added `loading-shimmer` and `loading-pulse-glow` keyframe animations |

### Deployment
- **Frontend**: Vercel (`smart-flashcards-nine.vercel.app`)
- **Edge Functions**: Supabase (`generate` function redeployed with `--no-verify-jwt`)

### Verified Flows
- Topic generation (Easy/Medium/Advanced) with correct card counts
- Loading screen with animated progress steps and skeleton cards
- Study mode: Show Answer flips card, rating buttons appear, cards advance, session completes
- Progress page updates with retention %, streak, and session stats
- Library shows saved decks with mastery percentage
