# ReadFlow - Speed Reading App

An enhanced reading app with focus-based speed reading capabilities, supporting EPUB, PDF, and text files. Features include text-to-speech, accessibility options, image block pause, and cloud sync via Supabase.

## Tech Stack

- **Desktop/Frontend**: Tauri + React + TypeScript
- **Parsing**: PDF.js, JSZip
- **Text-to-Speech**: Web Speech API
- **State Management**: Zustand
- **Backend**: Supabase (Firebase-like alternative)
- **Styling**: CSS with accessibility features

## Features

### Core Reading
- ✅ Word-by-word focus reading with adjustable WPM (50-1000 words per minute)
- ✅ Support for EPUB, PDF, and plain text files
- ✅ Bolded focal character for enhanced reading clarity
- ✅ Customizable font size, line height, and font family
- ✅ Image block auto-pause with user-controlled resume

### Accessibility
- ✅ Text-to-Speech with rate/pitch control
- ✅ High contrast mode
- ✅ Dyslexia-friendly font option
- ✅ Dark/Light mode toggle
- ✅ Keyboard shortcuts (Space, Arrows, +/-)
- ✅ ARIA labels and screen reader support

### Advanced
- ☐ Cloud sync via Supabase (reading progress, bookmarks, preferences)
- ☐ Bookmarks and highlights
- ☐ Reading notes
- ☐ OCR for scanned PDFs (future enhancement)
- ☐ Multi-language TTS support

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Tauri CLI: `npm install -g tauri-cli`

### Installation

1. **Clone/Navigate to project**
   ```bash
   cd Readable
   npm install
   ```

2. **Configure Supabase (Optional)**
   - Copy `.env.example` to `.env.local`
   - Add your Supabase credentials (or skip for local-only mode)

3. **Run in Development**
   ```bash
   npm run tauri dev
   ```

4. **Build for Production**
   ```bash
   npm run tauri build
   ```

## Project Structure

```
src/
├── components/          # React components
│   ├── FocusReader.tsx       # Main reading display
│   ├── PlaybackControls.tsx  # Speed/progress controls
│   ├── ImageBlockViewer.tsx  # Image handling
│   └── SettingsPanel.tsx     # User preferences
├── lib/                 # Core logic
│   ├── parser.ts            # EPUB/PDF/text parsing
│   ├── engine.ts            # Reading playback engine
│   ├── tts.ts               # Text-to-speech manager
│   └── supabase.ts          # Database client
├── store/               # Zustand state management
│   └── appStore.ts          # App-wide state
├── types/               # TypeScript interfaces
│   └── index.ts             # All type definitions
├── App.tsx              # Main app component
└── App.css              # Global styles

src-tauri/              # Rust backend (auto-generated)
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause/Resume |
| `←/→` | Seek 5 words back/forward |
| `+/-` | Increase/Decrease speed |
| `Ctrl+S` | Open settings |

## Component Overview

### FocusReader
Displays one word at a time with the focal character bolded and centered. Auto-pauses on images.

### PlaybackControls
Controls: play/pause/stop, WPM slider, progress bar, TTS toggle.

### ImageBlockViewer
Shows images in a modal with alt text, caption, and continue button.

### SettingsPanel
Customizable: font, size, TTS rate/pitch, high contrast, dyslexia font, dark mode.

## API Integration (Supabase)

Tables to create in Supabase:
```sql
-- Users (auto-created by auth)
-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY,
  title VARCHAR NOT NULL,
  author VARCHAR,
  format VARCHAR(10),
  file_path VARCHAR,
  total_words INTEGER,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reading sessions table
CREATE TABLE reading_sessions (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id),
  current_token_index INTEGER,
  current_block INTEGER,
  user_id UUID REFERENCES auth.users(id),
  last_read_at TIMESTAMP DEFAULT NOW()
);

-- User preferences table
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  font_family VARCHAR,
  font_size INTEGER,
  wpm INTEGER,
  dark_mode BOOLEAN,
  ... (other settings)
);
```

## Development

### Build Process
```bash
npm run tauri dev      # Development mode
npm run build          # Build frontend
npm run tauri build    # Full Tauri app build
```

### Linting & Type Checking
```bash
npx tsc --noEmit       # Type check
npm run lint           # ESLint (if configured)
```

## Known Limitations

1. EPUB parsing is simplified (text extraction only, not full layout)
2. PDF extraction works best with text-based PDFs (not scanned images)
3. TTS quality depends on system voices
4. Cloud sync requires Supabase setup

## Future Enhancements

- [ ] Full EPUB layout support with proper CSS handling
- [ ] OCR integration for scanned PDFs
- [ ] Advanced search and filtering
- [ ] Reading statistics dashboard
- [ ] Social features (share highlights, reading lists)
- [ ] Mobile app (React Native)
- [ ] Offline-first sync strategy
- [ ] Custom reading profiles per book

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request
