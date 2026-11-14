import { useEffect, useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useAppStore, useLibraryBooks } from '../../store/appStore';
import { Segmented, Switch } from '../../components/ui/controls';
import { Modal } from '../../components/ui/Overlay';
import { MOD_KEY_LABEL } from '../../components/shell/Sidebar';
import { formatBytes, formatNumber } from '../../lib/format';
import type { AppearancePrefs, Palette, ReadingPrefs, ThemeMode } from '../../types';
import {
  APP_VERSION,
  FOCAL_SWATCHES,
  TYPEFACE_FONTS,
  TYPEFACES,
  bionicCount,
  focalCss,
  orpIndex,
  useResolvedTheme,
} from './shared';

export type SectionId = 'reading' | 'appearance' | 'library' | 'backup' | 'shortcuts' | 'about';

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'reading', label: 'Reading' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'library', label: 'Library & files' },
  { id: 'backup', label: 'Backup & restore' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
  { id: 'about', label: 'About' },
];

/* ---------- Building blocks ---------- */

export function SettingRow({
  title,
  desc,
  children,
  stack,
}: {
  title: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
  /** Put the control under the text (wide controls) */
  stack?: boolean;
}) {
  return (
    <div className={`set-row ${stack ? 'stack' : ''}`}>
      <div className="set-row-text">
        <div className="set-row-title">{title}</div>
        {desc && <div className="set-row-desc">{desc}</div>}
      </div>
      {children !== undefined && <div className="set-row-control">{children}</div>}
    </div>
  );
}

export function RangeSlider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  width = 200,
  valueText,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  width?: number | string;
  valueText?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="set-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      aria-valuetext={valueText}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width, ['--pct' as string]: `${pct}%` }}
    />
  );
}

const clampWpm = (v: number) => Math.max(100, Math.min(1000, Math.round(v / 10) * 10));

export function WpmStepper() {
  const wpm = useAppStore((s) => s.readingPrefs.defaultWpm);
  const set = useAppStore((s) => s.setReadingPrefs);
  return (
    <div className="set-stepper" role="group" aria-label="Default speed">
      <button type="button" aria-label="Slower" onClick={() => set({ defaultWpm: clampWpm(wpm - 10) })} disabled={wpm <= 100}>
        <Minus size={15} strokeWidth={1.8} />
      </button>
      <span className="tabular" aria-live="polite" aria-label={`${wpm} words per minute`}>
        {wpm}
      </span>
      <button type="button" aria-label="Faster" onClick={() => set({ defaultWpm: clampWpm(wpm + 10) })} disabled={wpm >= 1000}>
        <Plus size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

/** Section heading; on mobile the pushed page header shows the title, so it is visually hidden. */
export function SectionHead({ title, intro, id, hidden }: { title: string; intro?: string; id: string; hidden?: boolean }) {
  return (
    <>
      <h2 className={hidden ? 'sr-only' : 'set-h2'} id={id}>
        {title}
      </h2>
      {intro && <p className="set-intro">{intro}</p>}
    </>
  );
}

/* ---------- Reading ---------- */

const READING_TOGGLES: { key: keyof ReadingPrefs; title: string; desc: string }[] = [
  { key: 'punctuationPause', title: 'Pause longer on punctuation', desc: 'Commas, full stops and paragraph breaks' },
  { key: 'longWordSlowdown', title: 'Slow down for long words', desc: 'Words over eight letters stay on screen a little longer' },
  { key: 'pauseAtImages', title: 'Pause at images', desc: 'Reading stops on figures and illustrations until you press Space' },
  { key: 'easeIn', title: 'Ease into speed', desc: 'Start each session slower and reach full speed over ten seconds' },
];

export function ReadingSection({ mobile }: { mobile?: boolean }) {
  const prefs = useAppStore((s) => s.readingPrefs);
  const set = useAppStore((s) => s.setReadingPrefs);
  return (
    <section aria-labelledby="set-reading-h">
      <SectionHead
        title="Reading"
        id="set-reading-h"
        hidden={mobile}
        intro={mobile ? undefined : 'Defaults for every book. Speed and appearance can be changed per book from the reader.'}
      />
      <div className="set-rows">
        <SettingRow title="Default speed" desc="Used the first time you open a book">
          {mobile ? (
            <WpmStepper />
          ) : (
            <div className="set-speed">
              <RangeSlider
                label="Default speed"
                min={100}
                max={1000}
                step={10}
                value={prefs.defaultWpm}
                valueText={`${prefs.defaultWpm} words per minute`}
                onChange={(v) => set({ defaultWpm: clampWpm(v) })}
              />
              <span className="set-speed-value tabular">
                {prefs.defaultWpm} <span>wpm</span>
              </span>
            </div>
          )}
        </SettingRow>
        <SettingRow title="Words per flash" desc="Two or three can help above 500 wpm">
          <Segmented
            label="Words per flash"
            value={prefs.wordsPerFlash}
            itemWidth={mobile ? 40 : 44}
            onChange={(v) => set({ wordsPerFlash: v })}
            options={[1, 2, 3].map((n) => ({ value: n as 1 | 2 | 3, label: String(n) }))}
          />
        </SettingRow>
        {READING_TOGGLES.map((t) => (
          <SettingRow key={t.key} title={t.title} desc={t.desc}>
            <Switch label={t.title} checked={prefs[t.key] as boolean} onChange={(v) => set({ [t.key]: v })} />
          </SettingRow>
        ))}
        <SettingRow
          title={mobile ? 'Hide controls' : 'Hide controls while reading'}
          desc={mobile ? 'Tap the screen to bring them back' : 'Move the mouse to bring them back'}
        >
          <Segmented
            label="Hide controls"
            value={prefs.hideControls}
            onChange={(v) => set({ hideControls: v })}
            options={[
              { value: '2s', label: 'After 2 s' },
              { value: 'never', label: 'Never' },
            ]}
          />
        </SettingRow>
      </div>
    </section>
  );
}

/* ---------- Appearance ---------- */

const PALETTES: {
  id: Palette;
  name: string;
  note: string;
  light: { bg: string; surface: string; accent: string; focal: string; ink: string };
  dark: { bg: string; surface: string; accent: string; focal: string; ink: string };
}[] = [
  {
    id: 'sepia',
    name: 'Sepia',
    note: 'Cream paper, rust accent',
    light: { bg: '#f4ede0', surface: '#fbf7ef', accent: '#9e3d27', focal: '#a83b22', ink: '#2b2118' },
    dark: { bg: '#1c1813', surface: '#25201a', accent: '#e0906f', focal: '#f0a07c', ink: '#ede4d3' },
  },
  {
    id: 'moss',
    name: 'Moss',
    note: 'Green parchment, deep moss accent',
    light: { bg: '#f1efe4', surface: '#f9f8f1', accent: '#3d6838', focal: '#2f6a3f', ink: '#22261c' },
    dark: { bg: '#171a14', surface: '#1f231b', accent: '#9cc48a', focal: '#a8d094', ink: '#e6e8d8' },
  },
];

const APPEARANCE_TOGGLES: { key: keyof AppearancePrefs; title: string; desc?: string }[] = [
  { key: 'ghostWords', title: 'Ghost words either side', desc: 'Faint neighbouring words around the current one' },
  { key: 'focusGuides', title: 'Focus guides', desc: 'Small ticks above and below the focal letter' },
  { key: 'contextWhenPaused', title: 'Show context when paused', desc: 'The surrounding paragraph appears when you pause' },
  { key: 'contextAlways', title: 'Always show context', desc: 'Keep the paragraph visible while playing, following the current word' },
  { key: 'bionic', title: 'Bionic font', desc: 'Bold the first half of each word' },
];

function WordPreview({ prefs, dark }: { prefs: AppearancePrefs; dark: boolean }) {
  const word = 'provincial';
  const before = ['the', 'side', 'of'];
  const after = ['fashion.', 'She'];
  const idx = orpIndex(word);
  const bold = prefs.bionic ? bionicCount(word) : 0;
  const font = TYPEFACE_FONTS[prefs.typeface];
  const focal = focalCss(prefs.focalColor, dark);
  const letter = (ch: string, i: number) => (
    <span key={i} style={i < bold ? { fontWeight: 700 } : undefined}>
      {ch}
    </span>
  );
  return (
    <div className="set-preview" aria-label={`Preview of the word “${word}” with your settings`} role="img">
      <div className="set-preview-stage" style={{ fontFamily: font, fontSize: prefs.wordSize }}>
        <span className="set-preview-left">
          {prefs.ghostWords && <span className="set-ghost">{before.join(' ')}&nbsp;</span>}
          <span>{word.slice(0, idx).split('').map((c, i) => letter(c, i))}</span>
        </span>
        <span className="set-preview-focal" style={{ color: focal }}>
          {prefs.focusGuides && <i className="set-guide top" style={{ background: focal }} />}
          {word[idx]}
          {prefs.focusGuides && <i className="set-guide bottom" style={{ background: focal }} />}
        </span>
        <span className="set-preview-right">
          <span>{word.slice(idx + 1).split('').map((c, i) => letter(c, i + idx + 1))}</span>
          {prefs.ghostWords && <span className="set-ghost">&nbsp;{after.join(' ')}</span>}
        </span>
      </div>
    </div>
  );
}

export function AppearanceSection({ mobile }: { mobile?: boolean }) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const palette = useAppStore((s) => s.palette);
  const setPalette = useAppStore((s) => s.setPalette);
  const prefs = useAppStore((s) => s.appearancePrefs);
  const set = useAppStore((s) => s.setAppearancePrefs);
  const resolved = useResolvedTheme();
  const dark = resolved === 'dark';

  return (
    <section aria-labelledby="set-appearance-h">
      <SectionHead title="Appearance" id="set-appearance-h" hidden={mobile} />
      <div className="set-rows">
        <SettingRow title="Theme" desc="System follows your computer’s light or dark setting">
          <Segmented<ThemeMode>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </SettingRow>
        <SettingRow title="Palette" stack>
          <div className="set-palettes" role="radiogroup" aria-label="Palette">
            {PALETTES.map((p) => {
              const c = dark ? p.dark : p.light;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={palette === p.id}
                  className="set-palette"
                  onClick={() => setPalette(p.id)}
                >
                  <span className="set-palette-swatch" style={{ background: c.bg }} aria-hidden="true">
                    <span className="set-palette-surface" style={{ background: c.surface, color: c.ink }}>
                      <span style={{ fontFamily: TYPEFACE_FONTS.literata }}>
                        re<b style={{ color: c.focal }}>a</b>d
                      </span>
                      <span className="set-palette-accent" style={{ background: c.accent }} />
                    </span>
                  </span>
                  <span className="set-palette-name">{p.name}</span>
                  <span className="set-palette-note">{p.note}</span>
                </button>
              );
            })}
          </div>
        </SettingRow>
      </div>

      <h3 className="set-h3">Reader</h3>
      <p className="set-intro">Defaults for every book. You can override them per book from the reader.</p>
      <WordPreview prefs={prefs} dark={dark} />
      <div className="set-rows">
        <SettingRow title="Typeface" stack>
          <div className="set-typefaces" role="radiogroup" aria-label="Typeface">
            {TYPEFACES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={prefs.typeface === t.value}
                className="set-typeface"
                style={{ fontFamily: TYPEFACE_FONTS[t.value], fontSize: t.size }}
                onClick={() => set({ typeface: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Word size" desc={`${prefs.wordSize} px in the reader`}>
          <div className="set-size">
            <button
              type="button"
              className="set-size-btn small"
              aria-label="Smaller"
              disabled={prefs.wordSize <= 56}
              onClick={() => set({ wordSize: Math.max(56, prefs.wordSize - 4) })}
            >
              A
            </button>
            <RangeSlider
              label="Word size"
              min={56}
              max={96}
              step={4}
              width={mobile ? '100%' : 160}
              value={prefs.wordSize}
              valueText={`${prefs.wordSize} pixels`}
              onChange={(v) => set({ wordSize: v })}
            />
            <button
              type="button"
              className="set-size-btn large"
              aria-label="Larger"
              disabled={prefs.wordSize >= 96}
              onClick={() => set({ wordSize: Math.min(96, prefs.wordSize + 4) })}
            >
              A
            </button>
          </div>
        </SettingRow>
        <SettingRow title="Focal letter" desc="Colour of the letter your eye rests on" stack={mobile}>
          <div className="set-swatches" role="radiogroup" aria-label="Focal letter colour">
            <button
              type="button"
              role="radio"
              aria-checked={prefs.focalColor === null}
              aria-label="Palette default"
              title="Palette default"
              className="set-swatch default"
              style={{ background: 'var(--focal)' }}
              onClick={() => set({ focalColor: null })}
            >
              <span aria-hidden="true">P</span>
            </button>
            {FOCAL_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={prefs.focalColor === c}
                aria-label={c}
                title={c}
                className="set-swatch"
                style={{ background: focalCss(c, dark) }}
                onClick={() => set({ focalColor: c })}
              />
            ))}
          </div>
        </SettingRow>
        {APPEARANCE_TOGGLES.map((t) => (
          <SettingRow key={t.key} title={t.title} desc={t.desc}>
            <Switch label={t.title} checked={!!prefs[t.key]} onChange={(v) => set({ [t.key]: v })} />
          </SettingRow>
        ))}
      </div>
    </section>
  );
}

/* ---------- Library & files ---------- */

export function LibrarySection({ mobile }: { mobile?: boolean }) {
  const books = useLibraryBooks();
  const allBooks = useAppStore((s) => s.books);
  const updateBook = useAppStore((s) => s.updateBook);
  const removeBook = useAppStore((s) => s.removeBook);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null | 'na'>(null);
  const [confirm, setConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    let alive = true;
    const est = navigator.storage?.estimate;
    if (!est) {
      setUsage('na');
      return;
    }
    navigator.storage
      .estimate()
      .then((e) => alive && setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => alive && setUsage('na'));
    return () => {
      alive = false;
    };
  }, [allBooks.length]);

  const totalWords = books.reduce((n, b) => n + (b.wordCount || 0), 0);
  const overrides = allBooks.filter((b) => b.appearance && Object.keys(b.appearance).length > 0);

  const resetOverrides = () => {
    overrides.forEach((b) => updateBook(b.id, { appearance: undefined }));
    setResetDone(true);
  };

  const removeAll = () => {
    useAppStore.getState().books.forEach((b) => removeBook(b.id));
    setConfirm(false);
  };

  return (
    <section aria-labelledby="set-library-h">
      <SectionHead title="Library & files" id="set-library-h" hidden={mobile} intro={mobile ? undefined : 'Files stay on this device.'} />
      <div className="set-rows">
        <SettingRow
          title="Your library"
          desc={
            books.length
              ? `${books.length} ${books.length === 1 ? 'book' : 'books'} · ${formatNumber(totalWords)} words`
              : 'No books yet'
          }
        />
        <SettingRow
          title="Storage used"
          desc={
            usage === null
              ? 'Measuring…'
              : usage === 'na'
                ? 'Not available on this system'
                : `${formatBytes(usage.used)}${usage.quota ? ` of ${formatBytes(usage.quota)} available` : ''}`
          }
        />
        <SettingRow
          title="Files stay on this device"
          desc="Books are read and stored locally. Nothing is uploaded, and there is no account to sign in to."
        />
        <SettingRow
          title="Per-book appearance"
          desc={
            resetDone && !overrides.length
              ? 'Every book now uses your Appearance defaults'
              : overrides.length
                ? `${overrides.length} ${overrides.length === 1 ? 'book has' : 'books have'} its own typeface, size or colours`
                : 'No books override your Appearance defaults'
          }
        >
          <button type="button" className="btn btn-sm" disabled={!overrides.length} onClick={resetOverrides}>
            Reset
          </button>
        </SettingRow>
        <SettingRow title="Account & sync" desc="Sync your library across devices">
          <span className="set-soon" aria-disabled="true">
            Soon
          </span>
        </SettingRow>
        <SettingRow title="Remove all books" desc="Deletes every book, its progress and its cover from this device. Reading stats are kept.">
          <button
            type="button"
            className="btn btn-sm set-danger"
            disabled={!allBooks.length}
            onClick={() => setConfirm(true)}
          >
            Remove all…
          </button>
        </SettingRow>
      </div>

      {confirm && (
        <Modal label="Remove all books" onClose={() => setConfirm(false)} className="set-confirm">
          <div className="set-confirm-body">
            <h2>
              Remove all {allBooks.length} {allBooks.length === 1 ? 'book' : 'books'}?
            </h2>
            <p>
              Their text, covers, bookmarks and reading progress will be deleted from this device. This can’t be
              undone. Your reading stats stay.
            </p>
          </div>
          <footer className="set-confirm-foot">
            <button type="button" className="btn" onClick={() => setConfirm(false)} autoFocus>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={removeAll}>
              Remove all books
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}

/* ---------- Keyboard shortcuts ---------- */

const READER_KEYS: { keys: string[]; label: string }[] = [
  { keys: ['Space'], label: 'Play or pause' },
  { keys: ['←', '→'], label: 'Previous or next word' },
  { keys: ['↑', '+'], label: 'Faster' },
  { keys: ['↓', '−'], label: 'Slower' },
  { keys: ['Esc'], label: 'Pause, or close a panel' },
];

export function ShortcutsSection() {
  const anywhere = [
    { keys: [MOD_KEY_LABEL], label: 'Search books and actions' },
    { keys: ['Esc'], label: 'Close search or a dialog' },
  ];
  const list = (title: string, items: { keys: string[]; label: string }[]) => (
    <div className="set-keys-group">
      <h3 className="set-keys-title">{title}</h3>
      <dl className="set-keys">
        {items.map((it) => (
          <div key={it.label} className="set-key-row">
            <dt>{it.label}</dt>
            <dd>
              {it.keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && <span className="set-key-or"> / </span>}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <section aria-labelledby="set-keys-h">
      <SectionHead title="Keyboard shortcuts" id="set-keys-h" intro="Speed changes by 25 wpm per press." />
      <div className="set-keys-cols">
        {list('Reader', READER_KEYS)}
        {list('Anywhere', anywhere)}
      </div>
    </section>
  );
}

/* ---------- About ---------- */

export function AboutSection({ mobile }: { mobile?: boolean }) {
  return (
    <section aria-labelledby="set-about-h" className="set-about">
      <SectionHead title="About" id="set-about-h" hidden={mobile} />
      <div className="set-about-head">
        <span className="set-wordmark">Readable</span>
        <span className="set-version">Version {APP_VERSION}</span>
      </div>
      <p className="set-about-p">
        Readable shows text one word at a time at the speed you choose, with the letter your eye should rest on
        picked out in colour. Import EPUB, PDF or plain-text files, or paste anything you want to get through, and
        read it without moving your eyes across a page. Everything stays on this device.
      </p>
      <h3 className="set-h3">Credits</h3>
      <ul className="set-credits">
        <li>
          <b>Newsreader</b> and <b>Literata</b> typefaces, by Production Type and TypeTogether. SIL Open Font
          License.
        </li>
        <li>
          <b>Atkinson Hyperlegible</b>, by the Braille Institute of America. SIL Open Font License.
        </li>
        <li>
          <b>OpenDyslexic</b>, by Abbie Gonzalez. SIL Open Font License.
        </li>
        <li>
          <b>Inter</b>, by Rasmus Andersson. SIL Open Font License.
        </li>
        <li>
          Icons from <b>Lucide</b>. ISC License.
        </li>
      </ul>
    </section>
  );
}
