import { describe, expect, it, vi } from 'vitest';

import { SmartListComponent } from './smart-list.component';

describe('SmartListComponent list-page preloading', () => {
  it('polls at least one configured page when the visible window is only partially filled', () => {
    const component = {
      config: {},
      items: [{ id: 'existing-ticket' }],
      currentQuery: vi.fn(() => ({
        page: 3,
        pageSize: 1,
        cursor: 'stale-cursor',
        filters: { order: 'upcoming' }
      })),
      resolveEffectivePageSize: vi.fn(() => 18)
    };
    const visiblePollQuery = Reflect.get(
      SmartListComponent.prototype,
      'visiblePollQuery'
    ) as (this: typeof component) => {
      page: number;
      pageSize: number;
      cursor?: string;
      filters: { order: string };
    };

    const query = visiblePollQuery.call(component);

    expect(query).toEqual({
      page: 0,
      pageSize: 18,
      cursor: undefined,
      filters: { order: 'upcoming' }
    });
  });

  it('polls the whole loaded window when it is larger than one configured page', () => {
    const component = {
      config: {},
      items: Array.from({ length: 36 }, (_value, index) => ({ id: `ticket-${index}` })),
      currentQuery: vi.fn(() => ({ page: 0, pageSize: 18 })),
      resolveEffectivePageSize: vi.fn(() => 18)
    };
    const visiblePollQuery = Reflect.get(
      SmartListComponent.prototype,
      'visiblePollQuery'
    ) as (this: typeof component) => { page: number; pageSize: number; cursor?: string };

    const query = visiblePollQuery.call(component);

    expect(query.pageSize).toBe(36);
  });

  it('polls only the first configured page when diff-sync owns a multi-page cache', () => {
    const component = {
      config: { pollDelta: {} },
      items: Array.from({ length: 60 }, (_value, index) => ({ id: `notification-${index}` })),
      currentQuery: vi.fn(() => ({
        page: 4,
        pageSize: 1,
        cursor: 'stale-cursor',
        filters: { bucket: 'new' }
      })),
      resolveEffectivePageSize: vi.fn(() => 20)
    };
    const visiblePollQuery = Reflect.get(
      SmartListComponent.prototype,
      'visiblePollQuery'
    ) as (this: typeof component) => {
      page: number;
      pageSize: number;
      cursor?: string;
      filters: { bucket: string };
    };

    const query = visiblePollQuery.call(component);

    expect(query).toEqual({
      page: 0,
      pageSize: 20,
      cursor: undefined,
      filters: { bucket: 'new' }
    });
  });

  it('applies only server-reported poll differences while preserving cached item references', () => {
    const older = { id: 'older', value: 1, createdAt: 1 };
    const unchanged = { id: 'unchanged', value: 1, createdAt: 2 };
    const changed = { id: 'changed', value: 1, createdAt: 3 };
    const component = {
      config: { pollDelta: {} },
      items: [changed, unchanged, older],
      total: 3,
      hasMore: false,
      currentQuery: vi.fn(() => ({})),
      cacheableConfig: vi.fn(() => ({
        identity: (item: { id: string }) => item.id
      })),
      sortableConfig: vi.fn(() => ({})),
      localSortKeyForItem: vi.fn((item: { createdAt: number }) => [-item.createdAt]),
      visibleInsertionIndex: Reflect.get(
        SmartListComponent.prototype,
        'visibleInsertionIndex'
      ),
      cacheDirectSourceItems: vi.fn(),
      syncGroups: vi.fn(),
      finiteStepper: { syncBounds: vi.fn() },
      emitState: vi.fn(),
      emitRefresh: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      refreshSurfaceSoon: vi.fn()
    };
    const syncVisiblePollDelta = Reflect.get(
      SmartListComponent.prototype,
      'syncVisiblePollDelta'
    ) as (
      this: typeof component,
      delta: {
        upserts: Array<{ id: string; value: number; createdAt: number }>;
        removedIds: string[];
        total: number;
      }
    ) => boolean;

    const updated = { id: 'changed', value: 2, createdAt: 3 };
    const inserted = { id: 'new', value: 1, createdAt: 4 };
    const changedResult = syncVisiblePollDelta.call(
      component,
      {
        upserts: [inserted, updated],
        removedIds: [],
        total: 4
      }
    );

    expect(changedResult).toBe(true);
    expect(component.items).toEqual([inserted, updated, unchanged, older]);
    expect(component.items[2]).toBe(unchanged);
    expect(component.items[3]).toBe(older);
  });

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
