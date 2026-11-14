import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { useIsMobile, useMediaQuery } from './hooks/useMediaQuery';
import { Sidebar } from './components/shell/Sidebar';
import { TabBar } from './components/shell/TabBar';
import { NewShelfDialog } from './components/shell/NewShelfDialog';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ReaderScreen } from './reader/ReaderScreen';
import { SearchOverlay } from './overlays/SearchOverlay';
import { ImportModal } from './overlays/ImportModal';
import { BookDetails } from './overlays/BookDetails';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster, notify } from './components/ui/Toaster';
import { isQuotaError } from './lib/bookStorage';
import { initAuth } from './lib/auth';
import './App.css';

/** Applies palette + resolved light/dark theme to <html> so tokens.css can switch. */
function useThemeAttributes() {
  const theme = useAppStore((s) => s.theme);
  const palette = useAppStore((s) => s.palette);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.palette = palette;
  }, [resolved, palette]);
}

/** Pasted text read without "Save to library" is dropped on the next launch. */
function usePurgeTransientBooks() {
  useEffect(() => {
    const { books, removeBook } = useAppStore.getState();
    books.filter((b) => b.transient).forEach((b) => removeBook(b.id));
  }, []);
}

/** Surface storage-full errors from places that can't catch them (e.g. the persisted store's localStorage writes). */
function useStorageErrorNotice() {
  useEffect(() => {
    const msg = 'Your device is out of storage space, so recent changes may not be saved. Remove a book or free up space.';
    const onError = (e: ErrorEvent) => {
      if (isQuotaError(e.error)) {
        e.preventDefault();
        notify(msg, 'error');
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isQuotaError(e.reason)) {
        e.preventDefault();
        notify(msg, 'error');
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
}

function AppShell() {
  useThemeAttributes();
  useStorageErrorNotice();
  useEffect(initAuth, []);
  usePurgeTransientBooks();

  const screen = useAppStore((s) => s.screen);
  const overlay = useAppStore((s) => s.overlay);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const closeOverlay = useAppStore((s) => s.closeOverlay);
  const isMobile = useIsMobile();
  const [newShelfOpen, setNewShelfOpen] = useState(false);

  // Global shortcuts: ⌘K / Ctrl+K opens Search anywhere; Esc closes overlays.
  // The reader registers its own keys (Space, arrows, speed) and handles Esc-to-pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openOverlay('search');
        return;
      }
      if (e.key === 'Escape' && useAppStore.getState().overlay !== 'none') {
        closeOverlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openOverlay, closeOverlay]);

  const isReader = screen === 'reader';
  const bookKey = useAppStore((s) => s.activeBookId);
  const openLibrary = useAppStore((s) => s.openLibrary);

  return (
    <div className={`app ${isMobile ? 'is-mobile' : 'is-desktop'}`}>
      {!isReader && !isMobile && <Sidebar onNewShelf={() => setNewShelfOpen(true)} />}

      <div className="app-main">
        <main className="app-content" data-screen={screen}>
          {screen === 'home' && <HomeScreen />}
          {screen === 'library' && <LibraryScreen />}
          {screen === 'collections' && <CollectionsScreen onNewShelf={() => setNewShelfOpen(true)} />}
          {screen === 'stats' && <StatsScreen />}
          {screen === 'settings' && <SettingsScreen />}
          {isReader && (
            <ErrorBoundary scope="reader" resetKey={bookKey} onLibrary={() => openLibrary()}>
              <ReaderScreen />
            </ErrorBoundary>
          )}
        </main>
        {!isReader && isMobile && <TabBar />}
      </div>

      {overlay === 'search' && <SearchOverlay />}
      {(overlay === 'import' || overlay === 'paste') && <ImportModal />}
      {overlay === 'details' && <BookDetails />}
      {newShelfOpen && <NewShelfDialog onClose={() => setNewShelfOpen(false)} />}
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary scope="app">
      <AppShell />
    </ErrorBoundary>
  );
}
