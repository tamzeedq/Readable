# ReadFlow Development Roadmap

## Phase 1: MVP Polish & Testing ✅ (COMPLETE)

- [x] Project setup with Tauri + React + TypeScript
- [x] Content parsing (EPUB, PDF, text)
- [x] Word-by-word focus reading engine
- [x] Playback controls (play, pause, stop, speed)
- [x] TTS integration
- [x] Image block handling
- [x] Settings panel with accessibility options
- [x] Dark mode support
- [x] Keyboard shortcuts
- [x] Responsive design
- [x] Build & compile to working desktop app

## Phase 2: Supabase Integration & Cloud Sync 🔄 (READY)

### Backend Setup
- [ ] Create Supabase project and database
- [ ] Set up authentication (email/password)
- [ ] Create tables: books, reading_sessions, user_preferences
- [ ] Configure RLS (Row Level Security) policies
- [ ] Test API connectivity

### Frontend Implementation
- [ ] Implement login/signup pages
- [ ] Wire auth state to Zustand store
- [ ] Sync reading progress to database
- [ ] Sync bookmarks and highlights
- [ ] Sync user preferences across devices
- [ ] Add offline-first caching with IndexedDB
- [ ] Implement conflict resolution strategy
- [ ] Add sync status indicator

### Testing
- [ ] Test multi-device sync
- [ ] Test offline mode with sync queue
- [ ] Test auth flows and session management
- [ ] Test data conflicts and resolution

## Phase 3: Enhanced Content Parsing 🎯 (HIGH PRIORITY)

### EPUB Improvements
- [ ] Implement full epubjs integration
- [ ] Support EPUB layout and CSS
- [ ] Extract metadata (author, cover, TOC)
- [ ] Handle embedded images and styles
- [ ] Support multiple encodings

### PDF Enhancements
- [ ] Improve text extraction accuracy
- [ ] Add OCR support with Tesseract.js
- [ ] Extract images from PDFs
- [ ] Handle complex layouts
- [ ] Support form fields and annotations

### Text Files
- [ ] Detect chapter breaks automatically
- [ ] Handle markdown formatting
- [ ] Support multiple encodings
- [ ] Parse table of contents

## Phase 4: Advanced Reading Features 💡 (IMPORTANT)

### Bookmarks & Highlights
- [ ] Visual highlighting in focus view
- [ ] Bookmark management UI
- [ ] Search within bookmarks/highlights
- [ ] Export highlights to markdown/PDF

### Reading Analytics
- [ ] Track reading time and speed
- [ ] Calculate comprehension (optional quiz)
- [ ] Generate reading statistics dashboard
- [ ] Show streak counter
- [ ] Recommend optimal WPM

### Reading Profiles
- [ ] Save per-book settings
- [ ] Auto-adjust WPM based on content complexity
- [ ] Create reading goals
- [ ] Track completion percentage

### Advanced Controls
- [ ] Backtrack and rewind by sentence
- [ ] Adjust focal letter position (not always center)
- [ ] Multiple reading modes (bionic, normal, block)
- [ ] Text filtering (skip punctuation, numbers)

## Phase 5: Library Management 📚 (MEDIUM PRIORITY)

### Book Organization
- [ ] Library view with grid/list options
- [ ] Search and filter books
- [ ] Metadata editing (add cover, author, tags)
- [ ] Organize into collections
- [ ] Track reading history

### File Management
- [ ] Drag & drop file upload
- [ ] Batch import multiple files
- [ ] Auto-organize by author/date
- [ ] Local file system access
- [ ] Cloud storage integration (Google Drive, Dropbox)

## Phase 6: Accessibility & Localization 🌍 (IMPORTANT)

### Accessibility
- [ ] Full keyboard navigation
- [ ] Screen reader testing with NVDA/JAWS
- [ ] WCAG 2.1 AA compliance audit
- [ ] Dyslexia-friendly fonts (OpenDyslexic, etc.)
- [ ] High contrast themes
- [ ] Text size presets for vision impairment

### Localization
- [ ] Translate UI to multiple languages
- [ ] Support RTL text (Arabic, Hebrew)
- [ ] Locale-specific TTS voices
- [ ] Currency/date localization for analytics

## Phase 7: Mobile App (React Native) 📱 (FUTURE)

- [ ] Set up React Native project
- [ ] Share parsing logic with web app
- [ ] Implement touch-optimized controls
- [ ] Native TTS integration
- [ ] Camera for PDF capture
- [ ] Offline-first architecture
- [ ] App store submissions (iOS, Android)

## Phase 8: Performance & Optimization 🚀 (MEDIUM PRIORITY)

### Frontend
- [ ] Code splitting for large PDFs
- [ ] Virtual scrolling for long documents
- [ ] Service Worker for offline mode
- [ ] Image optimization
- [ ] Bundle size reduction

### Backend
- [ ] Database query optimization
- [ ] Caching strategy for frequently accessed books
- [ ] CDN for file storage
- [ ] API rate limiting

## Phase 9: Advanced Features 🎨 (NICE TO HAVE)

- [ ] Social features (share highlights, reading lists)
- [ ] Community recommendations
- [ ] Reading groups/clubs
- [ ] Author highlights and notes
- [ ] Integration with Goodreads/StoryGraph
- [ ] Text-to-audio for accessibility
- [ ] Speed reading challenges/competitions
- [ ] Custom word lists for flashcards

## Phase 10: Documentation & Community 📖 (ONGOING)

- [ ] Complete API documentation
- [ ] Video tutorials
- [ ] User guide and FAQs
- [ ] Developer docs for contributors
- [ ] Community forum/Discord
- [ ] Bug bounty program
- [ ] Release notes and changelog

---

## Quick Start (Now)

1. Run the app:
   ```bash
   npm run tauri dev
   ```

2. Test with a text file to verify:
   - File upload works
   - Word-by-word display functions
   - Playback controls respond
   - Settings apply correctly

3. Next: Set up Supabase for Phase 2

## Tech Debt & Known Issues

- [ ] EPUB parsing is simplified (needs full layout support)
- [ ] PDF OCR not yet implemented
- [ ] No local storage persistence yet
- [ ] TTS quality depends on OS voices
- [ ] No error recovery for failed uploads
- [ ] Missing loading states for large files
- [ ] No progress indication during parsing

## Performance Targets

- Load small files (<1MB): < 1 second
- Parse medium files (1-10MB): < 5 seconds
- Playback should never stutter
- Memory usage < 500MB for typical book
- Battery: 6+ hours reading on laptop

## Priority Order

1. **High**: Supabase sync, EPUB improvements, accessibility
2. **Medium**: Library management, mobile app planning
3. **Low**: Advanced analytics, social features

---

**Updated**: January 31, 2026
**Maintainer**: @you
