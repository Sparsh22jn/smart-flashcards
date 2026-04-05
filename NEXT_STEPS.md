# Smart FlashCards — Next Steps

Comprehensive feature roadmap based on a full audit of all components, pages, libs, edge functions, database schema, and Stitch designs vs current implementation.

---

## P0 — Critical Missing Features

### 1. AI Coach / Chat UI
The `chat/index.ts` edge function is fully built (streams Claude responses via SSE) but there is **zero frontend for it**. Should add a chat panel in the Study session so users can ask for ELI5 explanations, mnemonics, or hints on demand. Could also surface as a floating action button on DeckDetail.

### 2. Import / Export
Designed in Stitch (`Import_Export.html`) but not implemented. Should support:
- **CSV** — Simple two-column (front, back) import/export
- **Anki (.apkg)** — SQLite-based format, widely used
- **JSON** — Full fidelity export/import with all card fields (front, back, explanation, mnemonic, difficulty)

Critical for user adoption — people need to bring existing decks from other apps.

### 3. Study Filters & Custom Sessions
Currently you can only study an entire deck in order. Missing:
- Filter by difficulty (easy/medium/hard)
- Due-only cards (cards scheduled for review today)
- Tag-based study (requires P2 tagging feature)
- Custom session size (e.g., "quiz me on 10 random cards")

### 4. Per-Deck Progress Tracking
Progress page only shows user-level aggregate stats. Should show:
- Accuracy per deck
- Retention rate per deck
- Time spent per deck
- Cards mastered vs remaining per deck

---

## P1 — High Priority

### 5. Dark Mode
Design system color tokens exist in `app.css` but no toggle. Settings page says "Coming soon." Needs:
- Dark theme CSS variables
- Toggle component in Settings
- Persist preference in `user_preferences` table
- System preference detection (`prefers-color-scheme`)

### 6. Keyboard Shortcuts
Study session needs:
- **Space** — Flip card / show answer
- **1-4** — Rate card (Again/Hard/Good/Easy)
- **Arrow keys** — Navigate between cards
- **Escape** — Exit study session

### 7. Undo Rating
During study, ability to go back and re-rate the previous card. Important for accidental taps — should keep a 1-card undo buffer.

### 8. Bulk Card Operations
In DeckDetail, support:
- Select multiple cards (checkbox mode)
- Bulk delete
- Bulk move to another deck
- Bulk difficulty change

### 9. Card Reordering
Drag-and-drop in DeckDetail to reorder cards. Could use a library like `@dnd-kit/core` or CSS-only sortable.

---

## P2 — Medium Priority

### 10. Advanced Analytics
Progress page is at ~40% fidelity vs the Stitch design. Missing:
- Retention trends over time (line chart)
- Time-of-day study heatmap
- Difficulty distribution (pie/bar chart)
- Mastery curves per deck
- Calendar view of study activity

### 11. Spaced Repetition Settings
Let users tune FSRS parameters:
- Min/max interval
- Ease factor adjustments
- New card limit per day
- Review card limit per day

DB table `user_preferences` exists but is unused — wire it up.

### 12. Card Tagging
Add tags to cards for:
- Filtering during study
- Organization within decks
- Cross-deck tag views

### 13. Search
Global search across all decks and cards. Currently no search functionality at all. Should search:
- Deck titles and descriptions
- Card fronts and backs
- Tags (if implemented)

### 14. Full FSRS-5 Algorithm
Current `fsrs.js` is a simplified implementation. Could upgrade to the full FSRS-5 algorithm with:
- Optimized weight parameters
- Stability/difficulty tracking
- Better interval scheduling for long-term retention

### 15. Audio / Text-to-Speech
Text-to-speech for card fronts/backs using the Web Speech API. Especially useful for language learning decks. Could also support audio file attachments on cards.

---

## P3 — Nice to Have

### 16. Deck Sharing
Generate read-only shareable links for decks. Other users can view and clone shared decks into their own library.

### 17. Offline Mode
Service worker + IndexedDB for studying without internet. Sync changes when back online. Critical for mobile usage in low-connectivity environments.

### 18. Image Support (Claude Vision)
Upload images (photos of textbooks, diagrams, whiteboard notes) and use Claude's vision capabilities to extract content and generate flashcards.

### 19. Word / PowerPoint Support
`handleFileUpload` currently rejects non-PDF files. Could add:
- `.docx` parsing (via mammoth.js or similar)
- `.pptx` parsing (slide content extraction)
- `.txt` / `.csv` direct import

### 20. Deployment Configuration
No Vercel/Netlify config in the repo. Should add:
- `vercel.json` or `netlify.toml`
- Environment variable documentation
- CI/CD pipeline (GitHub Actions)

### 21. PWA Manifest
Make the app installable on mobile as a Progressive Web App:
- `manifest.json` with icons
- Service worker for caching
- Splash screen configuration
- iOS/Android install prompts
