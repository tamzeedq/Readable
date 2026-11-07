import { useAppStore } from '../../store/appStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Typeface } from '../../types';

/** Font stacks for each reader typeface (fonts are bundled in main.tsx). */
export const TYPEFACE_FONTS: Record<Typeface, string> = {
  literata: "'Literata Variable', Georgia, serif",
  newsreader: "'Newsreader Variable', Georgia, serif",
  sans: "'Inter Variable', system-ui, sans-serif",
  atkinson: "'Atkinson Hyperlegible', system-ui, sans-serif",
  opendyslexic: "'OpenDyslexic', system-ui, sans-serif",
};

export const TYPEFACES: { value: Typeface; label: string; size: number }[] = [
  { value: 'literata', label: 'Literata', size: 18 },
  { value: 'newsreader', label: 'Newsreader', size: 19 },
  { value: 'sans', label: 'Sans', size: 16 },
  { value: 'atkinson', label: 'Atkinson', size: 16 },
  { value: 'opendyslexic', label: 'OpenDyslexic', size: 13 },
];

export const FOCAL_SWATCHES = ['#a83b22', '#2f6a3f', '#24407a', '#9a4f08', '#2b2118'];

/** Resolved light/dark theme (same rule App uses for data-theme). */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useAppStore((s) => s.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** Focal colour as rendered: swatches are lightened in dark mode; null = palette default. */
export function focalCss(color: string | null, dark: boolean): string {
  if (!color) return 'var(--focal)';
  return dark ? `color-mix(in oklch, ${color}, white 40%)` : color;
}

/** Optimal recognition point index by word length (trailing punctuation stripped). */
export function orpIndex(word: string): number {
  const len = word.replace(/[^\p{L}\p{N}]+$/u, '').length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/** Number of leading letters bolded in Bionic mode. */
export function bionicCount(word: string): number {
  const len = word.replace(/[^\p{L}\p{N}]+$/u, '').length;
  return Math.ceil(len / 2);
}

export const APP_VERSION = '0.1.0';
