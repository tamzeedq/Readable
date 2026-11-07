// Pure aggregation helpers for the Stats screen. All numbers come from the real reading log.
import type { Book, ReadingLog } from '../../types';
import { dayKey, formatMinutes, formatNumber, MONTHS_LONG, MONTHS_SHORT } from '../../lib/format';

export type StatsRange = 'week' | 'month' | 'year' | 'all';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** Rough printed-page length used for the "Roughly N pages" note */
const WORDS_PER_PAGE = 275;

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseDayKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

interface Period {
  /** inclusive YYYY-MM-DD */
  from: string;
  to: string;
}

export interface Totals {
  ms: number;
  words: number;
  /** per book id */
  books: Record<string, { ms: number; words: number }>;
}

function totalsFor(log: ReadingLog, p: Period | null): Totals {
  const t: Totals = { ms: 0, words: 0, books: {} };
  if (!p) return t;
  for (const [day, entries] of Object.entries(log)) {
    if (day < p.from || day > p.to) continue;
    for (const [bookId, s] of Object.entries(entries)) {
      t.ms += s.ms;
      t.words += s.words;
      const b = (t.books[bookId] ??= { ms: 0, words: 0 });
      b.ms += s.ms;
      b.words += s.words;
    }
  }
  return t;
}

function minutesOf(ms: number): number {
  return ms / 60000;
}

/** Average wpm from words and playing time; null when there isn't enough time to be meaningful. */
function avgWpm(t: Totals): number | null {
  const min = minutesOf(t.ms);
  if (min < 0.25 || t.words <= 0) return null;
  return Math.round(t.words / min);
}

function dayTotalMs(log: ReadingLog, key: string): number {
  const entries = log[key];
  if (!entries) return 0;
  let ms = 0;
  for (const s of Object.values(entries)) ms += s.ms;
  return ms;
}

/** Consecutive days with reading, ending today (or yesterday if nothing yet today). */
export function computeStreak(log: ReadingLog, now = new Date()): number {
  let d = startOfDay(now);
  if (dayTotalMs(log, dayKey(d)) <= 0) d = addDays(d, -1);
  let n = 0;
  while (dayTotalMs(log, dayKey(d)) > 0) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function firstLogDay(log: ReadingLog): string | null {
  const keys = Object.keys(log).filter((k) => dayTotalMs(log, k) > 0 || Object.values(log[k]).some((s) => s.words > 0));
  if (!keys.length) return null;
  return keys.sort()[0];
}

function rangeLabelDays(from: Date, to: Date): string {
  if (from.getFullYear() !== to.getFullYear()) {
    return `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]} ${from.getFullYear()} – ${to.getDate()} ${MONTHS_SHORT[to.getMonth()]} ${to.getFullYear()}`;
  }
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()} – ${to.getDate()} ${MONTHS_LONG[to.getMonth()]}`;
  }
  return `${from.getDate()} ${MONTHS_LONG[from.getMonth()]} – ${to.getDate()} ${MONTHS_LONG[to.getMonth()]}`;
}

export type BarTone = 'past' | 'current' | 'today';

export interface Bar {
  key: string;
  minutes: number;
  /** short axis label ("" = no label) */
  label: string;
  /** accessible / tooltip label, e.g. "Tue 6 Oct" */
  long: string;
  tone: BarTone;
}

export interface BookRow {
  bookId: string;
  book: Book | undefined;
  minutes: number;
}

export interface StatsModel {
  rangeLabel: string;
  chartTitle: string;
  bars: Bar[];
  /** Show the value label above the last bar */
  highlightLast: boolean;
  time: { value: string; note: string };
  words: { value: string; note: string };
  speed: { value: number | null; note: string };
  byBook: BookRow[];
  streak: number;
  hasAnyData: boolean;
  hasPeriodData: boolean;
}

const PERIOD_NOUN: Record<StatsRange, string> = {
  week: 'week',
  month: 'month',
  year: 'year',
  all: 'time',
};

function timeNote(range: StatsRange, cur: Totals, prev: Totals | null, hasAnyData: boolean, firstDay: string | null): string {
  if (!hasAnyData) return 'Press play on any book to start';
  if (range === 'all') {
    if (!firstDay) return 'Nothing logged yet';
    const d = parseDayKey(firstDay);
    return `Since ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  }
  const noun = PERIOD_NOUN[range];
  const curMin = Math.round(minutesOf(cur.ms));
  if (curMin <= 0 && cur.ms <= 0) return `Nothing logged this ${noun} yet`;
  if (!prev || prev.ms <= 0) return `Your first ${noun} of reading`;
  const prevMin = Math.round(minutesOf(prev.ms));
  const diff = curMin - prevMin;
  if (diff === 0) return `Same as last ${noun}`;
  const amount = Math.abs(diff) >= 120 ? formatMinutes(Math.abs(diff)) : `${Math.abs(diff)} min`;
  return `${amount} ${diff > 0 ? 'more' : 'less'} than last ${noun}`;
}

function fractionPhrase(f: number): string | null {
  if (f >= 1.9) return `${Math.round(f)} times the length of`;
  if (f >= 1.05) return 'More than all of';
  if (f >= 0.93) return 'Nearly all of';
  const named: [number, string][] = [
    [3 / 4, 'About three quarters of'],
    [2 / 3, 'About two thirds of'],
    [1 / 2, 'About half of'],
    [1 / 3, 'About a third of'],
    [1 / 4, 'About a quarter of'],
    [1 / 5, 'About a fifth of'],
    [1 / 10, 'About a tenth of'],
  ];
  for (const [v, label] of named) {
    if (Math.abs(f - v) <= v * 0.12) return label;
  }
  if (f >= 0.02) return `About ${Math.round(f * 100)}% of`;
  return null;
}

function wordsNote(cur: Totals, books: Book[], hasAnyData: boolean): string {
  if (!hasAnyData) return 'Every word you read is counted';
  if (cur.words <= 0) return 'No words yet in this period';
  // Book read most (by words) in the period
  let topId: string | null = null;
  let topWords = 0;
  for (const [id, s] of Object.entries(cur.books)) {
    if (s.words > topWords) {
      topWords = s.words;
      topId = id;
    }
  }
  const top = topId ? books.find((b) => b.id === topId) : undefined;
  if (top && top.wordCount > 2000 && !top.transient) {
    const phrase = fractionPhrase(cur.words / top.wordCount);
    if (phrase) return `${phrase} ${top.title}`;
  }
  const pages = Math.round(cur.words / WORDS_PER_PAGE);
  if (pages < 1) return 'Less than a page so far';
  return pages === 1 ? 'Roughly one page' : `Roughly ${formatNumber(pages)} pages`;
}

function speedNote(range: StatsRange, cur: number | null, prev: number | null, defaultWpm: number, hasAnyData: boolean): string {
  if (!hasAnyData || cur === null) return `Your default is ${defaultWpm} wpm`;
  if (range === 'all') return `Your default is ${defaultWpm} wpm`;
  const noun = PERIOD_NOUN[range];
  if (prev === null) return `Your default is ${defaultWpm} wpm`;
  if (cur === prev) return `Same as last ${noun}`;
  return `${cur > prev ? 'Up' : 'Down'} from ${prev} last ${noun}`;
}

export function buildStats(
  log: ReadingLog,
  books: Book[],
  range: StatsRange,
  defaultWpm: number,
  now = new Date(),
): StatsModel {
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const firstDay = firstLogDay(log);
  const hasAnyData = firstDay !== null;

  let period: Period;
  let prevPeriod: Period | null;
  let rangeLabel: string;
  let bars: Bar[] = [];
  let chartTitle = 'Minutes per day';

  const dayBar = (d: Date, tone: BarTone, label: string): Bar => {
    const key = dayKey(d);
    return {
      key,
      minutes: Math.round(minutesOf(dayTotalMs(log, key))),
      label,
      long: `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
      tone,
    };
  };

  if (range === 'week' || range === 'month') {
    const len = range === 'week' ? 7 : 30;
    const from = addDays(today, -(len - 1));
    period = { from: dayKey(from), to: todayKey };
    prevPeriod = { from: dayKey(addDays(from, -len)), to: dayKey(addDays(from, -1)) };
    rangeLabel = rangeLabelDays(from, today);
    if (range === 'week') {
      // 14 bars: previous 7 muted, current 7 tinted, today accent
      for (let i = 13; i >= 0; i--) {
        const d = addDays(today, -i);
        bars.push(dayBar(d, i === 0 ? 'today' : i < 7 ? 'current' : 'past', WEEKDAY_INITIAL[d.getDay()]));
      }
    } else {
      for (let i = 29; i >= 0; i--) {
        const d = addDays(today, -i);
        bars.push(dayBar(d, i === 0 ? 'today' : 'current', i % 5 === 0 ? String(d.getDate()) : ''));
      }
    }
  } else {
    // Monthly bars
    chartTitle = 'Minutes per month';
    let firstMonth: Date;
    if (range === 'year' || !firstDay) {
      firstMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    } else {
      const f = parseDayKey(firstDay);
      firstMonth = new Date(f.getFullYear(), f.getMonth(), 1);
      // Always show at least 6 months so a short history doesn't look like a broken chart
      const min = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      if (firstMonth > min) firstMonth = min;
    }
    const months: Date[] = [];
    for (let d = new Date(firstMonth); d <= today; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      months.push(d);
    }
    const perMonth: Record<string, number> = {};
    for (const day of Object.keys(log)) {
      const mk = day.slice(0, 7);
      perMonth[mk] = (perMonth[mk] ?? 0) + dayTotalMs(log, day);
    }
    const every = months.length > 24 ? 6 : months.length > 14 ? 3 : 1;
    bars = months.map((d, i) => {
      const mk = monthKey(d);
      const isLast = i === months.length - 1;
      const showYear = every > 1 || months.length > 12;
      let label = '';
      if ((months.length - 1 - i) % every === 0) {
        label = showYear && d.getMonth() === 0 ? `’${String(d.getFullYear()).slice(2)}` : MONTHS_SHORT[d.getMonth()].charAt(0);
      }
      return {
        key: mk,
        minutes: Math.round(minutesOf(perMonth[mk] ?? 0)),
        label,
        long: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`,
        tone: isLast ? 'today' : 'current',
      };
    });

    if (range === 'year') {
      const from = firstMonth;
      period = { from: dayKey(from), to: todayKey };
      const prevFrom = new Date(from.getFullYear() - 1, from.getMonth(), 1);
      prevPeriod = { from: dayKey(prevFrom), to: dayKey(addDays(from, -1)) };
      rangeLabel = `${MONTHS_SHORT[from.getMonth()]} ${from.getFullYear()} – ${MONTHS_SHORT[today.getMonth()]} ${today.getFullYear()}`;
    } else {
      period = { from: '0000-00-00', to: '9999-99-99' };
      prevPeriod = null;
      if (firstDay) {
        const f = parseDayKey(firstDay);
        rangeLabel = `Since ${MONTHS_LONG[f.getMonth()]} ${f.getFullYear()}`;
      } else {
        rangeLabel = 'Everything so far';
      }
    }
  }

  const cur = totalsFor(log, period);
  const prev = prevPeriod ? totalsFor(log, prevPeriod) : null;
  const curWpm = avgWpm(cur);
  const prevWpm = prev ? avgWpm(prev) : null;

  const byBook: BookRow[] = Object.entries(cur.books)
    .filter(([, s]) => s.ms > 0)
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, 5)
    .map(([bookId, s]) => ({ bookId, book: books.find((b) => b.id === bookId), minutes: minutesOf(s.ms) }));

  return {
    rangeLabel,
    chartTitle,
    bars,
    highlightLast: true,
    time: { value: formatDuration(minutesOf(cur.ms)), note: timeNote(range, cur, prev, hasAnyData, firstDay) },
    words: { value: formatNumber(cur.words), note: wordsNote(cur, books, hasAnyData) },
    speed: { value: curWpm, note: speedNote(range, curWpm, prevWpm, defaultWpm, hasAnyData) },
    byBook,
    streak: computeStreak(log, now),
    hasAnyData,
    hasPeriodData: cur.ms > 0 || cur.words > 0,
  };
}

/** "4 h 39 m", "41 m", "0 m" (formatMinutes but zero reads as zero) */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 m';
  return formatMinutes(minutes);
}

