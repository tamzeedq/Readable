import { useAppStore } from '../../store/appStore';
import { NAV_ITEMS } from './Sidebar';

/** Mobile bottom tab bar (replaces the sidebar under the mobile breakpoint). */
export function TabBar() {
  const screen = useAppStore((s) => s.screen);
  const navigate = useAppStore((s) => s.navigate);
  const openLibrary = useAppStore((s) => s.openLibrary);
  return (
    <nav className="tabbar" aria-label="Main">
      {NAV_ITEMS.map(({ screen: s, label, Icon }) => (
        <button
          key={s}
          aria-current={screen === s ? 'page' : undefined}
          onClick={() => (s === 'library' ? openLibrary() : navigate(s))}
        >
          <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
