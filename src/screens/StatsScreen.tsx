import { useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Segmented } from '../components/ui/controls';
import { formatMinutes } from '../lib/format';
import { buildStats, formatDuration, type Bar, type StatsRange } from './stats/statsData';
import './stats/Stats.css';

const RANGES: { value: StatsRange; label: string; short: string }[] = [
  { value: 'week', label: 'Week', short: 'Week' },
  { value: 'month', label: 'Month', short: 'Month' },
  { value: 'year', label: 'Year', short: 'Year' },
  { value: 'all', label: 'All time', short: 'All' },
];

const BAR_BG: Record<Bar['tone'], string> = {
  past: 'var(--line-strong)',
  current: 'color-mix(in oklch, var(--accent) 45%, var(--surface))',
  today: 'var(--accent)',
};

function minutesLabel(m: number): string {
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
}

function BarChart({ bars, mobile }: { bars: Bar[]; mobile: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((b) => b.minutes));
  const scale = max > 0 ? max * 1.05 : 1;
  const dense = bars.length > 16;
  const gap = mobile ? (dense ? 2 : 5) : dense ? 4 : 10;
  const cols = `repeat(${bars.length}, minmax(0, 1fr))`;

  return (
    <div className="st-chart">
      <div className="st-bars" style={{ gridTemplateColumns: cols, gap }} onMouseLeave={() => setHover(null)}>
        {bars.map((b, i) => {
          const isLast = i === bars.length - 1;
          return (
            <div
              key={b.key}
              className="st-bar-col"
              role="img"
              tabIndex={0}
              aria-label={`${b.long}: ${minutesLabel(b.minutes)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((h) => (h === i ? null : h))}
            >
              {isLast && <span className="st-bar-value tabular">{b.minutes}</span>}
              <div
                className="st-bar"
                style={{ height: `${(b.minutes / scale) * 100}%`, background: BAR_BG[b.tone] }}
              />
              {hover === i && (
                <span
                  className={`st-tip ${i < 2 ? 'left' : i > bars.length - 3 ? 'right' : ''}`}
                  role="presentation"
                  aria-hidden="true"
                >
                  {b.long} · {b.minutes ? formatMinutes(b.minutes) : '0 m'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="st-labels" style={{ gridTemplateColumns: cols, gap }} aria-hidden="true">
        {bars.map((b) => (
          <span key={b.key}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

export function StatsScreen() {
  const readingLog = useAppStore((s) => s.readingLog);
  const books = useAppStore((s) => s.books);
  const defaultWpm = useAppStore((s) => s.readingPrefs.defaultWpm);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const isMobile = useIsMobile();
  const [range, setRange] = useState<StatsRange>('week');

  const m = useMemo(
    () => buildStats(readingLog, books, range, defaultWpm),
    [readingLog, books, range, defaultWpm],
  );
  const topMinutes = m.byBook[0]?.minutes ?? 1;

  const header = (
    <header className="st-header">
      <div className="page-title">
        <h1>Stats</h1>
        <span className="meta">{m.rangeLabel}</span>
      </div>
      {!isMobile && (
        <Segmented
          label="Range"
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
        />
      )}
    </header>
  );

  const speedValue = (
    <>
      {m.speed.value ?? '—'} <span className="st-unit">wpm</span>
    </>
  );

  return (
    <div className={`screen st-screen ${isMobile ? 'st-mobile' : ''}`}>
      {header}
      {isMobile && (
        <Segmented
          className="st-range-m"
          label="Range"
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r.value, label: r.short, ariaLabel: r.label }))}
        />
      )}

      <section className="st-kpis" aria-label="Totals">
        <div className="st-kpi st-kpi-time">
          <span className="st-kpi-label">Time reading</span>
          <span className="st-kpi-value tabular">{m.time.value}</span>
          <span className="st-kpi-note">{m.time.note}</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi-label">Words read</span>
          <span className="st-kpi-value tabular">{m.words.value}</span>
          <span className="st-kpi-note">{m.words.note}</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi-label">{isMobile ? 'Avg speed' : 'Average speed'}</span>
          <span className="st-kpi-value tabular">{speedValue}</span>
          <span className="st-kpi-note">{m.speed.note}</span>
        </div>
      </section>

      <div className="st-lower">
        <section className="st-card st-chart-card" aria-label={m.chartTitle}>
          <div className="st-card-head">
            <h2>{m.chartTitle}</h2>
            {m.streak > 0 && <span className="st-streak">{m.streak}-day streak</span>}
          </div>
          <BarChart bars={m.bars} mobile={isMobile} />
          {!m.hasAnyData && (
            <p className="st-empty">Nothing logged yet. Read for a few minutes and your time, words and streak will gather here, a day at a time.</p>
          )}
        </section>

        <section className="st-card st-books" aria-label="By book">
          <h2>By book</h2>
          {m.byBook.length === 0 ? (
            <p className="st-empty">
              {m.hasAnyData ? 'No reading in this period.' : 'Books you read will be listed here. Open one from your library to begin.'}
            </p>
          ) : (
            <ul>
              {m.byBook.map((r, i) => {
                const canOpen = !!r.book && !r.book.transient;
                const title = r.book?.title ?? 'Removed book';
                return (
                  <li key={r.bookId}>
                    <div className="st-book-row">
                      {canOpen ? (
                        <button
                          type="button"
                          className="st-book-title"
                          onClick={() => openOverlay('details', r.bookId)}
                          title={`Details for ${title}`}
                        >
                          {title}
                        </button>
                      ) : (
                        <span className={`st-book-title ${r.book ? '' : 'removed'}`}>{title}</span>
                      )}
                      <span className="st-book-time tabular">{formatDuration(r.minutes)}</span>
                    </div>
                    <div className="st-book-track" aria-hidden="true">
                      <div
                        style={{
                          width: `${Math.max(2, (r.minutes / topMinutes) * 100)}%`,
                          background: i === 0 ? 'var(--accent)' : BAR_BG.current,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
