import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement;

async function mountApp() {
  vi.resetModules();
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  const { default: App } = await import('../App');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(App));
  });
}

beforeEach(() => localStorage.clear());
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  host?.remove();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const dialog = (label: string) => document.querySelector(`[role="dialog"][aria-label="${label}"]`);
const key = (k: string, target: EventTarget = window) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  });

describe('first-run intro', () => {
  it('shows on a fresh profile and not again after it is dismissed', async () => {
    await mountApp();
    expect(dialog('Welcome to Readable')).not.toBeNull();
    await act(async () => {
      (Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Skip intro') as HTMLElement).click();
    });
    expect(dialog('Welcome to Readable')).toBeNull();
    await act(async () => root!.unmount());
    root = null;
    await mountApp();
    expect(dialog('Welcome to Readable')).toBeNull();
  });
});

describe('shortcuts overlay', () => {
  it('opens on ? outside inputs, lists the README keys, closes on Esc', async () => {
    localStorage.setItem('readable-v1', JSON.stringify({ state: { onboarded: true }, version: 4 }));
    await mountApp();
    const input = document.createElement('input');
    document.body.appendChild(input);
    await key('?', input);
    expect(dialog('Keyboard shortcuts')).toBeNull();
    await key('?');
    const d = dialog('Keyboard shortcuts');
    expect(d).not.toBeNull();
    const text = d!.textContent ?? '';
    for (const k of ['Space', '←', '→', '↑', '+', '↓', '−', 'Esc', '?']) expect(text).toContain(k);
    expect(text).toMatch(/Ctrl K|⌘K/);
    await key('Escape');
    expect(dialog('Keyboard shortcuts')).toBeNull();
  });
});
