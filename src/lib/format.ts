// Small formatting helpers shared across screens.

/** Local-date key YYYY-MM-DD */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "10 h 12 m", "41 m", "< 1 m" */
export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 1) return '< 1 m';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} m`;
  return `${h} h ${String(rest).padStart(2, '0')} m`;
}

/** Time left to read `wordsLeft` at `wpm` — "10 h 12 m" */
export function formatTimeLeft(wordsLeft: number, wpm: number): string {
  return formatMinutes(wordsLeft / Math.max(1, wpm));
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today", "Yesterday", "Oct 6" */
export function formatRelativeDay(t: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(t);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "3 September" */
export function formatLongDate(t: number): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/** "Friday, 9 October" */
export function formatHeaderDate(d = new Date()): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/** "Today at 7:42 pm" / "Oct 6 at 9:10 am" */
export function formatDateTime(t: number): string {
  const d = new Date(t);
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${formatRelativeDay(t)} at ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export { MONTHS_SHORT, MONTHS_LONG };
