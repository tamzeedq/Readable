import {
  BookOpen,
  ChartNoAxesColumn,
  CircleCheck,
  CirclePlay,
  Clock,
  House,
  Layers,
  PanelLeft,
  Plus,
  Search,
  Settings,
  User,
} from 'lucide-react';
import { useMemo } from 'react';
import { bookStatus, isRecentlyAdded, useAppStore, useLibraryBooks } from '../../store/appStore';
import { useAuth } from '../../lib/auth';
import { useSyncStatus } from '../../lib/sync/app';
import type { Screen } from '../../types';
import './Sidebar.css';

export const NAV_ITEMS: { screen: Screen; label: string; Icon: typeof House }[] = [
  { screen: 'home', label: 'Home', Icon: House },
  { screen: 'library', label: 'Library', Icon: BookOpen },
  { screen: 'collections', label: 'Collections', Icon: Layers },
  { screen: 'stats', label: 'Stats', Icon: ChartNoAxesColumn },
  { screen: 'settings', label: 'Settings', Icon: Settings },
];

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD_KEY_LABEL = isMac ? '⌘K' : 'Ctrl K';

export function Sidebar({ onNewShelf }: { onNewShelf: () => void }) {
  const screen = useAppStore((s) => s.screen);
  const navigate = useAppStore((s) => s.navigate);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const openLibrary = useAppStore((s) => s.openLibrary);
  const libraryFilter = useAppStore((s) => s.libraryFilter);
  const shelves = useAppStore((s) => s.shelves);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const books = useLibraryBooks();
  const auth = useAuth();
  const sync = useSyncStatus((x) => x.state);
  const syncLabel = { idle: '', syncing: 'Syncing', synced: 'Synced', offline: 'Offline', error: 'Sync problem' }[sync];
  const accountLabel = auth.status === 'signed-in' && auth.user?.email ? auth.user.email : auth.status === 'unavailable' ? 'Account' : 'Sign in';

  const counts = useMemo(() => {
    const byShelf: Record<string, number> = {};
    let recent = 0;
    let inProgress = 0;
    let finished = 0;
    for (const b of books) {
      b.shelves.forEach((id) => (byShelf[id] = (byShelf[id] ?? 0) + 1));
      if (isRecentlyAdded(b)) recent++;
      const st = bookStatus(b);
      if (st === 'in-progress') inProgress++;
      if (st === 'finished') finished++;
    }
    return { byShelf, recent, inProgress, finished };
  }, [books]);

  if (collapsed) {
    return (
      <aside className="sidebar sidebar-collapsed" aria-label="Sidebar">
        <button className="icon-btn" aria-label="Expand sidebar" onClick={() => setCollapsed(false)}>
          <PanelLeft size={18} strokeWidth={1.6} />
        </button>
        <button className="icon-btn" aria-label="Search books and actions" onClick={() => openOverlay('search')}>
          <Search size={18} strokeWidth={1.6} />
        </button>
        <nav aria-label="Main" className="sidebar-nav">
          {NAV_ITEMS.map(({ screen: s, label, Icon }) => (
            <button
              key={s}
              className="icon-btn"
              aria-label={label}
              title={label}
              aria-current={screen === s ? 'page' : undefined}
              data-active={screen === s}
              onClick={() => navigate(s)}
            >
              <Icon size={19} strokeWidth={1.6} />
            </button>
          ))}
        </nav>
      </aside>
    );
  }

  const shelfActive = (id: string) => screen === 'library' && libraryFilter.shelfId === id;

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar-brand">
        <span className="wordmark">Readable</span>
        <button className="icon-btn" aria-label="Collapse sidebar" onClick={() => setCollapsed(true)}>
          <PanelLeft size={18} strokeWidth={1.6} />
        </button>
      </div>

      <button className="sidebar-search" aria-label="Search books and actions" onClick={() => openOverlay('search')}>
        <Search size={17} strokeWidth={1.6} aria-hidden="true" />
        <span>Search</span>
        <kbd>{MOD_KEY_LABEL}</kbd>
      </button>

      <nav aria-label="Main" className="sidebar-nav">
        {NAV_ITEMS.map(({ screen: s, label, Icon }) => (
          <a
            key={s}
            href="#"
            className="nav-item"
            aria-current={screen === s ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              if (s === 'library') openLibrary();
              else navigate(s);
            }}
          >
            <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>

      <div className="sidebar-scroll">
        <section className="sidebar-group" aria-label="Shelves">
          <div className="sidebar-group-head">
            <span>Shelves</span>
            <button className="icon-btn icon-btn-sm" aria-label="New shelf" onClick={onNewShelf}>
              <Plus size={16} strokeWidth={1.6} />
            </button>
          </div>
          {shelves.map((sh) => (
            <a
              key={sh.id}
              href="#"
              className="sidebar-row"
              aria-current={shelfActive(sh.id) ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                openLibrary({ shelfId: sh.id });
              }}
            >
              <span className="shelf-tab" style={{ background: sh.color }} aria-hidden="true" />
              <span className="row-name">{sh.name}</span>
              <span className="row-count">{counts.byShelf[sh.id] ?? 0}</span>
            </a>
          ))}
        </section>

        <section className="sidebar-group" aria-label="Smart lists">
          <div className="sidebar-group-head">
            <span>Smart lists</span>
          </div>
          <SmartRow
            Icon={Clock}
            label="Recently added"
            count={counts.recent}
            active={screen === 'library' && libraryFilter.recent}
            onClick={() => openLibrary({ recent: true })}
          />
          <SmartRow
            Icon={CirclePlay}
            label="In progress"
            count={counts.inProgress}
            active={screen === 'library' && libraryFilter.status === 'in-progress' && !libraryFilter.shelfId}
            onClick={() => openLibrary({ status: 'in-progress' })}
          />
          <SmartRow
            Icon={CircleCheck}
            label="Finished"
            count={counts.finished}
            active={screen === 'library' && libraryFilter.status === 'finished' && !libraryFilter.shelfId}
            onClick={() => openLibrary({ status: 'finished' })}
          />
        </section>
      </div>

      <button
        type="button"
        className="sidebar-footer sidebar-account"
        onClick={() => {
          useAppStore.setState({ settingsTarget: 'account' });
          navigate('settings');
        }}
      >
        <User size={18} strokeWidth={1.6} aria-hidden="true" />
        <span>{accountLabel}</span>
        {auth.status === 'signed-in' && syncLabel && (
          <span className="sync-state" data-state={sync} title={syncLabel}>
            <span className="sync-dot" aria-hidden="true" />
            <span className="sr-only">{syncLabel}</span>
          </span>
        )}
      </button>
    </aside>
  );
}

function SmartRow({
  Icon,
  label,
  count,
  active,
  onClick,
}: {
  Icon: typeof Clock;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href="#"
      className="sidebar-row"
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <Icon size={16} strokeWidth={1.6} aria-hidden="true" className="row-icon" />
      <span className="row-name">{label}</span>
      <span className="row-count">{count}</span>
    </a>
  );
}
