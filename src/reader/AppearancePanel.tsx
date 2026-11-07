import { useEffect, useRef } from 'react';
import { useAppStore, useAppearance } from '../store/appStore';
import { Switch } from '../components/ui/controls';
import { Sheet } from '../components/ui/Overlay';
import type { AppearancePrefs, Typeface } from '../types';
import { Slider } from './Slider';
import { CloseIcon } from './icons';

export const TYPEFACES: { id: Typeface; label: string; family: string; tileSize: number }[] = [
  { id: 'literata', label: 'Literata', family: "'Literata Variable', Georgia, serif", tileSize: 18 },
  { id: 'newsreader', label: 'Newsreader', family: "'Newsreader Variable', Georgia, serif", tileSize: 17 },
  { id: 'sans', label: 'Sans', family: "'Inter Variable', system-ui, sans-serif", tileSize: 16 },
  { id: 'atkinson', label: 'Atkinson', family: "'Atkinson Hyperlegible', system-ui, sans-serif", tileSize: 16 },
  { id: 'opendyslexic', label: 'OpenDyslexic', family: "'OpenDyslexic', system-ui, sans-serif", tileSize: 14 },
];

export function typefaceFamily(t: Typeface): string {
  return (TYPEFACES.find((f) => f.id === t) ?? TYPEFACES[0]).family;
}

export const FOCAL_SWATCHES = ['#a83b22', '#2f6a3f', '#24407a', '#9a4f08', '#2b2118'];
const SWATCH_NAMES: Record<string, string> = {
  '#a83b22': 'Rust',
  '#2f6a3f': 'Moss',
  '#24407a': 'Ink blue',
  '#9a4f08': 'Amber',
  '#2b2118': 'Near black',
};

export const DESKTOP_SIZE = { min: 56, max: 96, step: 4 };
export const MOBILE_SIZE = { min: 32, max: 60, step: 2, def: 44 };

export function paletteFocal(palette: string): string {
  return palette === 'moss' ? '#2f6a3f' : '#a83b22';
}

/** Shared body of the popover and the sheet. Writes per-book overrides. */
function AppearanceBody({ bookId, mobile, onClose }: { bookId: string; mobile: boolean; onClose: () => void }) {
  const ap = useAppearance(bookId);
  const palette = useAppStore((s) => s.palette);
  const setBookAppearance = useAppStore((s) => s.setBookAppearance);
  const setAppearancePrefs = useAppStore((s) => s.setAppearancePrefs);
  const hasOverride = useAppStore((s) => {
    const a = s.books.find((b) => b.id === bookId)?.appearance;
    return !!a && Object.keys(a).length > 0;
  });
  const set = (patch: Partial<AppearancePrefs>) => setBookAppearance(bookId, patch);

  const range = mobile ? MOBILE_SIZE : DESKTOP_SIZE;
  const size = mobile ? (ap.mobileWordSize ?? MOBILE_SIZE.def) : ap.wordSize;
  const setSize = (v: number) => {
    const n = Math.max(range.min, Math.min(range.max, Math.round(v / range.step) * range.step));
    set(mobile ? { mobileWordSize: n } : { wordSize: n });
  };
  const ghost = mobile ? (ap.mobileGhostWords ?? false) : ap.ghostWords;
  const curFocal = ap.focalColor ?? paletteFocal(palette);

  const rows: [string, boolean, (v: boolean) => void][] = [
    ['Ghost words either side', ghost, (v) => set(mobile ? { mobileGhostWords: v } : { ghostWords: v })],
    ['Focus guides', ap.focusGuides, (v) => set({ focusGuides: v })],
    ['Show context when paused', ap.contextWhenPaused, (v) => set({ contextWhenPaused: v })],
    ['Always show context', ap.contextAlways, (v) => set({ contextAlways: v })],
    ['Bionic font', ap.bionic, (v) => set({ bionic: v })],
  ];

  const useAsDefault = () => {
    const { appearancePrefs, books } = useAppStore.getState();
    const override = books.find((b) => b.id === bookId)?.appearance ?? {};
    setAppearancePrefs({ ...appearancePrefs, ...override });
  };

  return (
    <>
      <div className="rd-ap-head">
        <h2>Appearance</h2>
        <button type="button" className="rd-ap-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="rd-ap-section">
        {!mobile && <span className="rd-ap-label">Typeface</span>}
        <div role="radiogroup" aria-label="Typeface" className="rd-ap-faces">
          {TYPEFACES.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={ap.typeface === f.id}
              className="rd-ap-face"
              style={{ fontFamily: f.family, fontSize: mobile ? Math.min(17, f.tileSize) : f.tileSize }}
              onClick={() => set({ typeface: f.id })}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rd-ap-section">
        <div className="rd-ap-row-between">
          <span className="rd-ap-label">Word size</span>
          <span className="rd-ap-readout">{size} px</span>
        </div>
        <div className="rd-ap-size">
          <button type="button" className="rd-ap-a" aria-label="Smaller" style={{ fontSize: 14 }} onClick={() => setSize(size - range.step)}>
            A
          </button>
          <Slider
            label="Word size"
            value={size}
            min={range.min}
            max={range.max}
            step={range.step}
            valueText={`${size} pixels`}
            onChange={setSize}
            height={mobile ? 20 : 16}
            thumb={mobile ? 20 : 16}
            className="rd-ap-slider"
          />
          <button type="button" className="rd-ap-a" aria-label="Larger" style={{ fontSize: mobile ? 21 : 20 }} onClick={() => setSize(size + range.step)}>
            A
          </button>
        </div>
      </div>

      <div className={mobile ? 'rd-ap-focal-m' : 'rd-ap-section rd-ap-focal'}>
        <span className="rd-ap-label">Focal letter</span>
        <div role="radiogroup" aria-label="Focal letter colour" className="rd-ap-swatches">
          {FOCAL_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === curFocal}
              aria-label={SWATCH_NAMES[c] ?? c}
              className="rd-ap-swatch"
              onClick={() => set({ focalColor: c })}
            >
              <span style={{ background: c, boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${c === curFocal ? 'var(--ink)' : 'transparent'}` }} />
            </button>
          ))}
        </div>
      </div>

      <div className="rd-ap-switches">
        {rows.map(([label, on, flip]) => (
          <div key={label} className="rd-ap-switch-row">
            <span>{label}</span>
            <Switch checked={on} onChange={flip} label={label} />
          </div>
        ))}
      </div>

      <div className="rd-ap-foot">
        <button type="button" className="rd-ap-link" onClick={useAsDefault} disabled={!hasOverride}>
          Use as default for all books
        </button>
        {hasOverride && (
          <button
            type="button"
            className="rd-ap-link"
            onClick={() => useAppStore.getState().updateBook(bookId, { appearance: undefined })}
          >
            Reset
          </button>
        )}
      </div>
    </>
  );
}

/** Desktop popover (screen 11), anchored top 64 / right 16. */
function AppearancePopover({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest?.('[data-rd-appearance-toggle]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [onClose]);
  return (
    <aside
      ref={ref}
      role="dialog"
      aria-label="Reading appearance"
      className="rd-ap-popover"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <AppearanceBody bookId={bookId} mobile={false} onClose={onClose} />
    </aside>
  );
}

export function AppearancePanel({ bookId, mobile, onClose }: { bookId: string; mobile: boolean; onClose: () => void }) {
  if (mobile) {
    return (
      <Sheet onClose={onClose} label="Reading appearance" lightScrim className="rd-ap-sheet">
        <div className="rd-ap-sheet-body">
          <AppearanceBody bookId={bookId} mobile onClose={onClose} />
        </div>
      </Sheet>
    );
  }
  return <AppearancePopover bookId={bookId} onClose={onClose} />;
}
