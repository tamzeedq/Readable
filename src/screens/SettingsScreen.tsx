import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  AboutSection,
  AppearanceSection,
  LibrarySection,
  ReadingSection,
  SECTIONS,
  ShortcutsSection,
  type SectionId,
} from './settings/sections';
import { AccountSection } from './settings/AccountSection';
import { BackupSection } from './settings/BackupSection';
import './settings/Settings.css';

function SectionBody({ id, mobile }: { id: SectionId; mobile?: boolean }) {
  switch (id) {
    case 'reading':
      return <ReadingSection mobile={mobile} />;
    case 'appearance':
      return <AppearanceSection mobile={mobile} />;
    case 'library':
      return <LibrarySection mobile={mobile} />;
    case 'account':
      return <AccountSection mobile={mobile} />;
    case 'backup':
      return <BackupSection mobile={mobile} />;
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'about':
      return <AboutSection mobile={mobile} />;
  }
}

function DesktopSettings() {
  const [section, setSection] = useState<SectionId>(() => takeTarget() ?? 'reading');
  return (
    <div className="screen set-screen">
      <div className="set-side">
        <h1 className="set-h1">Settings</h1>
        <nav aria-label="Settings sections" className="set-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={section === s.id ? 'page' : undefined}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="set-main" key={section}>
        <SectionBody id={section} />
      </div>
    </div>
  );
}

/** One-shot deep link (e.g. from the sidebar's Account entry) to a settings section */
function takeTarget(): SectionId | null {
  const t = useAppStore.getState().settingsTarget;
  if (!t) return null;
  useAppStore.setState({ settingsTarget: null });
  return t as SectionId;
}

const MORE_ROWS: { id: SectionId; label: string; meta?: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'library', label: 'Library & files' },
  { id: 'account', label: 'Account' },
  { id: 'backup', label: 'Backup & restore' },
  { id: 'about', label: 'About' },
];

function MobileSettings() {
  const [sub, setSub] = useState<SectionId | null>(() => takeTarget());

  if (sub) {
    const label = SECTIONS.find((s) => s.id === sub)?.label ?? '';
    return (
      <div className="screen set-mobile set-m-sub">
        <div className="set-m-back-row">
          <button type="button" className="set-m-back" onClick={() => setSub(null)}>
            <ChevronLeft size={22} strokeWidth={1.6} aria-hidden="true" />
            Settings
          </button>
        </div>
        <h1 className="set-m-h1">{label}</h1>
        <div className="set-m-card set-m-section">
          <SectionBody id={sub} mobile />
        </div>
      </div>
    );
  }

  return (
    <div className="screen set-mobile">
      <h1 className="set-m-h1">Settings</h1>
      <div className="set-m-group">Reading</div>
      <div className="set-m-card set-m-section">
        <ReadingSection mobile />
      </div>
      <div className="set-m-group more">More</div>
      <div className="set-m-card">
        {MORE_ROWS.map((r) => (
            <button key={r.id} type="button" className="set-m-more" onClick={() => setSub(r.id)}>
              <span>{r.label}</span>
              <span className="set-m-more-meta">
                {r.meta}
                <ChevronRight size={15} strokeWidth={1.6} aria-hidden="true" />
              </span>
            </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSettings /> : <DesktopSettings />;
}
