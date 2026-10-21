import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { preloadAdapterMode } from './app/shared/core/base/adapter-loaders';

// Unit fixtures construct services directly instead of running application
// bootstrap. Reuse its code-only preparation for tests of either transport;
// Angular still owns all instances and each fixture supplies its own data.
beforeAll(async () => {
  await Promise.all([preloadAdapterMode('local'), preloadAdapterMode('http')]);
});

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
