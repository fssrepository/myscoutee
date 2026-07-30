import { describe, expect, it, vi } from 'vitest';

import { SmartListComponent } from './smart-list.component';

describe('SmartListComponent list-page preloading', () => {
  it('loads and exposes the next page even when the cached has-more flag is stale', async () => {
    const component = {
      currentViewMode: 'list',
      loading: false,
      hasMore: false,
      items: [{ id: 'first-page' }],
      loadNextPage: vi.fn(async function (this: { items: Array<{ id: string }> }) {
        this.items = [...this.items, { id: 'second-page' }];
      })
    };

    const loaded = await SmartListComponent.prototype.preloadNextListPage.call(
      component as never,
      { force: true }
    );

    expect(component.loadNextPage).toHaveBeenCalledOnce();
    expect(loaded).toBe(true);
    expect(component.items).toHaveLength(2);
  });

  it('does not start a duplicate preload while a page is loading', async () => {
    const component = {
      currentViewMode: 'list',
      loading: true,
      hasMore: true,
      items: [{ id: 'first-page' }],
      loadNextPage: vi.fn()
    };

    const loaded = await SmartListComponent.prototype.preloadNextListPage.call(component as never);

    expect(component.loadNextPage).not.toHaveBeenCalled();
    expect(loaded).toBe(false);
  });
});
