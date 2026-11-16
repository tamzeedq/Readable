import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

function block(selectorPart: string): Record<string, string> {
  const re = /([^{}]+)\{([^}]*)\}/g;
  const out: Record<string, string> = {};
  for (const m of css.matchAll(re)) {
    if (!m[1].includes(selectorPart)) continue;
    for (const d of m[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const parse = (v: string): [number, number, number, number] => {
  const h = v.match(/^#([0-9a-f]{6})$/i);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)).concat(1) as [number, number, number, number];
  const r = v.match(/rgba?\(([^)]+)\)/);
  if (!r) throw new Error(`unsupported colour ${v}`);
  const p = r[1].split(',').map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
};
const L = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (fg: string, bg: string) => {
  const f = parse(fg), b = parse(bg);
  const a = Math.max(L(f), L(b)), c = Math.min(L(f), L(b));
  return (a + 0.05) / (c + 0.05);
};

const palettes = ['sepia', 'moss'] as const;
const modes = ['light', 'dark'] as const;

// [foreground token, background token] pairs used for body-size text
const PAIRS: [string, string][] = [
  ['--ink', '--bg'], ['--ink', '--surface'], ['--ink', '--sidebar'], ['--ink', '--chip'],
  ['--muted', '--bg'], ['--muted', '--surface'], ['--muted', '--sidebar'], ['--muted', '--chip'],
  ['--accent-text', '--bg'], ['--accent-text', '--surface'],
  ['--on-accent', '--accent'],
  ['--focal', '--bg'], ['--focal', '--surface'],
];

describe('token contrast (WCAG AA text ≥ 4.5:1)', () => {
  for (const p of palettes)
    for (const m of modes) {
      const t = { ...block(`data-palette='${p}'][data-theme='${m}'`) };
      if (p === 'sepia' && m === 'light') Object.assign(t, block(':root,'));
      it(`${p} ${m}`, () => {
        for (const [fg, bg] of PAIRS) {
          expect(t[fg], fg).toBeDefined();
          expect(ratio(t[fg], t[bg]), `${fg} on ${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
});
