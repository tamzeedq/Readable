import { create } from 'zustand';
import { Book, ReadingSession, PlaybackSettings, User } from '../types';

export interface AppStore {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;

  // Books state
  books: Book[];
  currentBook: Book | null;
  setBooks: (books: Book[]) => void;
  setCurrentBook: (book: Book | null) => void;
  addBook: (book: Book) => void;
  removeBook: (bookId: string) => void;

  // Reading session state
  currentSession: ReadingSession | null;
  setCurrentSession: (session: ReadingSession | null) => void;
  updateSessionProgress: (tokenIndex: number, blockIndex: number) => void;
  addBookmark: (tokenIndex: number) => void;
  removeBookmark: (tokenIndex: number) => void;

  // Playback settings
  playbackSettings: PlaybackSettings;
  updatePlaybackSettings: (settings: Partial<PlaybackSettings>) => void;

  // UI state
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;

  // Sync state
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncedAt: (date: Date | null) => void;
}

const defaultPlaybackSettings: PlaybackSettings = {
  wordsPerMinute: 300,
  focusLineHeight: 1.5,
  fontSize: 48,
  fontFamily: 'Inter, system-ui, sans-serif',
  focalLetterBoldness: 75,
  enableTTS: false,
  ttsRate: 1,
  ttsPitch: 1,
  highContrast: false,
  dyslexiaFriendlyFont: false,
  darkMode: true,
};

export const useAppStore = create<AppStore>((set) => ({
  // User state
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  // Books state
  books: [],
  currentBook: null,
  setBooks: (books) => set({ books }),
  setCurrentBook: (book) => set({ currentBook: book }),
  addBook: (book) =>
    set((state) => ({
      books: [...state.books, book],
    })),
  removeBook: (bookId) =>
    set((state) => ({
      books: state.books.filter((b) => b.id !== bookId),
      currentBook: state.currentBook?.id === bookId ? null : state.currentBook,
    })),

  // Reading session state
  currentSession: null,
  setCurrentSession: (session) => set({ currentSession: session }),
  updateSessionProgress: (tokenIndex, blockIndex) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            currentTokenIndex: tokenIndex,
            currentBlock: blockIndex,
            lastReadAt: new Date(),
          }
        : null,
    })),
  addBookmark: (tokenIndex) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            bookmarks: [...new Set([...state.currentSession.bookmarks, tokenIndex])],
          }
        : null,
    })),
  removeBookmark: (tokenIndex) =>
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            bookmarks: state.currentSession.bookmarks.filter((t) => t !== tokenIndex),
          }
        : null,
    })),

  // Playback settings
  playbackSettings: defaultPlaybackSettings,
  updatePlaybackSettings: (newSettings) =>
    set((state) => ({
      playbackSettings: {
        ...state.playbackSettings,
        ...newSettings,
      },
    })),

  // UI state
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),
  darkMode: true,
  setDarkMode: (dark) => set({ darkMode: dark }),

  // Sync state
  isSyncing: false,
  lastSyncedAt: null,
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncedAt: (date) => set({ lastSyncedAt: date }),
}));
