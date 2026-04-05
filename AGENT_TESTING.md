# Smart FlashCards — Agent Testing Plan

Claude Code agents can read code, run builds, and execute CLI commands — but cannot open a browser, click buttons, or visually inspect the rendered UI. This document outlines three practical approaches to approximate real-user testing via agents.

---

## Approach 1: Automated E2E Testing (Playwright)

**What it does:** Write and run end-to-end tests that launch a real browser, navigate the app, fill forms, click buttons, and assert behavior — all programmatically.

**What it catches:**
- Broken navigation flows (routing issues)
- Forms that don't submit correctly
- Missing elements or broken conditional rendering
- Auth flow failures
- API integration issues (generate, save, study)
- Accessibility violations (via `@axe-core/playwright`)

**What it misses:**
- Visual regressions (spacing, alignment, color)
- Animation smoothness
- Responsive design issues (though viewport can be set)
- "Feel" — whether interactions feel natural

**Setup:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Example test structure:**
```
tests/
├── auth.spec.ts          # Login, signup, logout flows
├── generate.spec.ts      # Topic, YouTube, PDF generation
├── library.spec.ts       # Deck list, create, delete
├── deck-detail.spec.ts   # Card editing, deletion
├── study.spec.ts         # Study session, rating, completion
├── progress.spec.ts      # Stats display
├── settings.spec.ts      # Account info, sign out
```

**Key flows to test:**
1. Sign up → Generate cards from topic → Save deck → Study deck → See progress
2. Paste YouTube URL → Preview appears → Generate → Cards display correctly
3. Upload PDF → Preview card → Generate → Save deck
4. Edit card in deck detail → Verify changes persist
5. Complete study session → Check stats update

---

## Approach 2: Lighthouse / Accessibility Audits

**What it does:** Run Google Lighthouse against the dev server to get automated scores for performance, accessibility, SEO, and best practices.

**What it catches:**
- Performance issues (large bundles, render-blocking resources, LCP)
- Accessibility violations (missing alt text, poor contrast, no ARIA labels)
- SEO problems (missing meta tags, no structured data)
- Best practice violations (insecure resources, deprecated APIs)

**What it misses:**
- Functional correctness
- Business logic bugs
- Visual design quality

**Setup:**
```bash
# Run dev server first, then:
npx lighthouse http://localhost:5173 --output=json --output-path=./lighthouse-report.json

# Or use the Chrome-based CLI for full audits:
npx lighthouse http://localhost:5173 --view
```

**Pages to audit:**
- `/` (Home)
- `/generate` (Generate)
- `/library` (Library)
- `/study/:deckId` (Study — needs auth + test data)
- `/progress` (Progress)
- `/settings` (Settings)

---

## Approach 3: Screenshot Review (Human + Agent)

**What it does:** You (the human) use the app normally, take screenshots of each page/state, and share them with the agent. The agent analyzes the images and provides detailed UI/UX feedback.

**What it catches:**
- Visual design issues (spacing, alignment, hierarchy)
- Color contrast problems
- Typography issues
- Responsive layout bugs
- Missing states (empty, loading, error)
- Inconsistencies with the Stitch designs
- Animation/transition issues (if screen-recorded)

**What it misses:**
- Nothing — this is the most complete approach since a human is actually using it

**Recommended screenshot checklist:**
- [ ] Home page (logged out)
- [ ] Auth screen (login + signup)
- [ ] Home page (logged in, empty state)
- [ ] Home page (logged in, with decks)
- [ ] Generate page (empty)
- [ ] Generate page (YouTube URL entered, preview shown)
- [ ] Generate page (PDF uploaded, preview shown)
- [ ] Generate page (cards being generated, streaming)
- [ ] Generate page (cards generated, ready to save)
- [ ] Library page (empty state)
- [ ] Library page (with multiple decks)
- [ ] Deck detail page (viewing cards)
- [ ] Deck detail page (editing a card)
- [ ] Study session (card front shown)
- [ ] Study session (card flipped, answer shown)
- [ ] Study session (rating buttons visible)
- [ ] Study session (completion screen)
- [ ] Progress page
- [ ] Settings page
- [ ] Mobile viewport (any 3-4 key pages)

---

## Recommended Order

1. **Start with Approach 1 (Playwright)** — catches functional bugs fast, automatable, repeatable
2. **Run Approach 2 (Lighthouse)** — quick wins for performance and accessibility
3. **Finish with Approach 3 (Screenshots)** — final polish pass for visual quality

All three approaches can be run by the agent (1 & 2 fully autonomous, 3 requires user screenshots).
