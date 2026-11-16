import type { Book } from '../../types';
import type { LocalSnapshot } from './types';

export const defaultPrefs: LocalSnapshot['prefs'] = {
  readingPrefs: {
    defaultWpm: 300, wordsPerFlash: 1, punctuationPause: true, longWordSlowdown: true,
    pauseAtImages: true, easeIn: true, hideControls: '2s',
  },
  appearancePrefs: {
    typeface: 'literata', wordSize: 72, focalColor: null, ghostWords: true, focusGuides: true,
    contextWhenPaused: true, contextAlways: false, bionic: false,
  },
  theme: 'system',
  palette: 'sepia',
};

export const makeBook = (id: string, over: Partial<Book> = {}): Book => ({
  id, title: `Book ${id.slice(0, 4)}`, author: 'Someone', format: 'epub', sizeBytes: 1234, wordCount: 5000,
  chapters: [{ title: 'One', startWord: 0 }, { title: 'Two', startWord: 2000 }],
  progressWordIndex: 0, lastReadAt: null, addedAt: Date.UTC(2026, 0, 1), finishedAt: null,
  shelves: [], tags: ['a'], hasCover: false, coverHue: 120, bookmarks: [], ...over,
});

export const emptySnapshot = (): LocalSnapshot => ({
  books: [], shelves: [], prefs: structuredClone(defaultPrefs), readingLog: {}, bookFiles: {}, stamps: {},
});
