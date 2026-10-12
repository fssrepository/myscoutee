import { afterEach, beforeEach, vi } from 'vitest';

// jsdom has no matchMedia; default desktop tests do not exercise responsive CSS.
// Tests for viewport or native permissions override this with their own fixture.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true
  }));
});
afterEach(() => vi.unstubAllGlobals());
