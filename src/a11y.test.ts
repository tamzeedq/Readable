import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeBook } from './lib/sync/testUtils';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./lib/bookStorage', async (orig) => ({
  ...(await orig<typeof import('./lib/bookStorage')>()),
  loadBookContent: vi.fn(async (id: string) => ({
    bookId: id,
    words: 'The quiet river kept moving past the old stone bridge at dawn.'.split(' '),
    paragraphStarts: [0],
    images: [],
  })),
  loadCover: vi.fn(async () => undefined),
}));

let root: Root | null = null;
let host: HTMLElement;
type Store = typeof import('./store/appStore').useAppStore;
let store: Store;

async function mountApp(mobile = false) {
  vi.resetModules();
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: mobile && q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  localStorage.setItem(
    'readable-v1',
    JSON.stringify({ state: { onboarded: true, books: [makeBook('b1', { title: 'River book', wordCount: 12 })] }, version: 4 }),
  );
  store = (await import('./store/appStore')).useAppStore;
  const { default: App } = await import('./App');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(App));
  });
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  host?.remove();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const run = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  // color-contrast is not computable in jsdom; token contrast is covered by styles/contrast.test.ts
  return axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
};
const bad = (r: Awaited<ReturnType<typeof run>>) =>
  r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`);

const screens = ['home', 'library', 'collections', 'stats', 'settings'] as const;
describe('axe: screens', () => {
  for (const mobile of [false, true])
    for (const s of screens)
      it(`${s}${mobile ? ' (mobile)' : ''}`, async () => {
        await mountApp(mobile);
        await act(async () => store.getState().navigate(s));
        expect(bad(await run())).toEqual([]);
      });
  it('reader', async () => {
    await mountApp();
    await act(async () => store.getState().openReader('b1'));
    expect(bad(await run())).toEqual([]);
  });
  it('reader (mobile)', async () => {
    await mountApp(true);
    await act(async () => store.getState().openReader('b1'));
    expect(bad(await run())).toEqual([]);
  });
});

const overlays = ['search', 'import', 'paste', 'details', 'shortcuts', 'onboarding'] as const;
const dialogs = () => document.querySelector<HTMLElement>('[role="dialog"]');
const tab = (shift = false) =>
  act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }));
  });

describe('axe + focus: overlays', () => {
  for (const o of overlays)
    it(o, async () => {
      await mountApp();
      await act(async () => store.getState().navigate('library'));
      const trigger = document.createElement('button');
      trigger.textContent = 'trigger';
      document.body.appendChild(trigger);
      trigger.focus();
      await act(async () => store.getState().openOverlay(o, o === 'details' ? 'b1' : undefined));
      const d = dialogs();
      expect(d, 'dialog present').not.toBeNull();
      expect(d!.contains(document.activeElement), 'focus moved inside').toBe(true);
      expect(bad(await run())).toEqual([]);
      // Tab trapped: cycling forward then backward never leaves the dialog
      for (let i = 0; i < 4; i++) {
        await tab();
        expect(d!.contains(document.activeElement)).toBe(true);
      }
      await tab(true);
      expect(d!.contains(document.activeElement)).toBe(true);
      // Esc closes and focus returns to the trigger
      await act(async () => {
        (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(dialogs()).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
});
