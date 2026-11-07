import { useState } from 'react';
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
import './settings/Settings.css';

function SectionBody({ id, mobile }: { id: SectionId; mobile?: boolean }) {
  switch (id) {
    case 'reading':
      return <ReadingSection mobile={mobile} />;
    case 'appearance':
      return <AppearanceSection mobile={mobile} />;
    case 'library':
      return <LibrarySection mobile={mobile} />;
    case 'shortcuts':
      return <ShortcutsSection />;
    case 'about':
      return <AboutSection mobile={mobile} />;
  }
}

function DesktopSettings() {
  const [section, setSection] = useState<SectionId>('reading');
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

const MORE_ROWS: { id: SectionId | 'account'; label: string; meta?: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'library', label: 'Library & files' },
  { id: 'account', label: 'Account & sync', meta: 'Soon' },
  { id: 'about', label: 'About' },
];

function MobileSettings() {
  const [sub, setSub] = useState<SectionId | null>(null);

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
        {MORE_ROWS.map((r) =>
          r.id === 'account' ? (
            <div key={r.id} className="set-m-more disabled" aria-disabled="true">
              <span>{r.label}</span>
              <span className="set-m-more-meta">{r.meta}</span>
            </div>
          ) : (
            <button key={r.id} type="button" className="set-m-more" onClick={() => setSub(r.id as SectionId)}>
              <span>{r.label}</span>
              <span className="set-m-more-meta">
                {r.meta}
                <ChevronRight size={15} strokeWidth={1.6} aria-hidden="true" />
              </span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSettings /> : <DesktopSettings />;
}
