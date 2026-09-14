import { describe, expect, it, vi } from 'vitest';

import { SmartListComponent } from './smart-list.component';

type Row = { id: string; value: number };

function subject(items: Row[]) {
  const component = {
    currentViewMode: 'list', items, total: items.length, hasMore: false, nextPageCursor: null as string | null,
    orderSortableItems: (rows: Row[]) => [...rows],
    cacheTrackKey: (row: Row) => row.id,
    currentQuery: () => ({}),
    cacheableConfig: () => ({ equals: (left: Row, right: Row) => left.id === right.id && left.value === right.value }),
    replaceVisibleItems: vi.fn((rows: Row[], options: { total: number; hasMore: boolean; nextCursor?: string | null }) => {
      component.items = rows;
      component.total = options.total;
      component.hasMore = options.hasMore;
      if ('nextCursor' in options) component.nextPageCursor = options.nextCursor ?? null;
    }),
    cacheDirectSourceItems: vi.fn(), syncGroups: vi.fn(), emitState: vi.fn(), emitRefresh: vi.fn(),
    finiteStepper: { syncBounds: vi.fn() }, cdr: { markForCheck: vi.fn() }
  };
  return component;
}

const sync = Reflect.get(SmartListComponent.prototype, 'syncVisibleItems') as (
  this: ReturnType<typeof subject>, rows: Row[], options?: { total?: number; hasMore?: boolean; nextCursor?: string | null }
) => boolean;

describe('SmartList visible synchronization across window changes', () => {
  it('retains the selected unchanged object when another changed row moves ahead of it', () => {
    const selected = { id: 'selected', value: 1 };
    const changed = { id: 'changed', value: 1 };
    const component = subject([selected, changed]);
    const incoming = { ...changed, value: 2 };

    expect(sync.call(component, [incoming, { ...selected }])).toBe(true);

    expect(component.items).toEqual([incoming, selected]);
    expect(component.items[0]).toBe(incoming);
    expect(component.items[1]).toBe(selected);
  });

  it('preserves surviving identities through insertion, removal and a changed page cursor', () => {
    const kept = { id: 'kept', value: 1 };
    const removed = { id: 'removed', value: 1 };
    const inserted = { id: 'inserted', value: 1 };
    const component = subject([removed, kept]);

    sync.call(component, [{ ...kept }, inserted], { total: 3, hasMore: true, nextCursor: 'next' });

    expect(component.items[0]).toBe(kept);
    expect(component.items[1]).toBe(inserted);
    expect(component.items.some(row => row.id === removed.id)).toBe(false);
    expect(component.total).toBe(3);
    expect(component.hasMore).toBe(true);
    expect(component.nextPageCursor).toBe('next');
  });

  it('does not publish or replace an unchanged window', () => {
    const kept = { id: 'kept', value: 1 };
    const component = subject([kept]);

    expect(sync.call(component, [{ ...kept }])).toBe(false);

    expect(component.items[0]).toBe(kept);
    expect(component.replaceVisibleItems).not.toHaveBeenCalled();
    expect(component.emitState).not.toHaveBeenCalled();
    expect(component.emitRefresh).not.toHaveBeenCalled();
  });
});

describe('SmartList row keys while Angular reconciles a reordered snapshot', () => {
  it('keeps the old changed object associated with its own key until Angular removes it', () => {
    const first = { id: 'first', value: 1 };
    const second = { id: 'second', value: 1 };
    const component = {
      items: [first, second], config: { trackBy: (_index: number, row: Row) => row.id },
      resolvedListTrackKeys: [] as Array<string | number>,
      listItemIndexByObject: new WeakMap<object, number>(),
      resolvedListTrackKeyByObject: new WeakMap<object, string | number>(),
      normalizedConfiguredTrackKey: (_index: number, row: Row) => row.id,
      rememberResolvedListTrackKey: Reflect.get(SmartListComponent.prototype, 'rememberResolvedListTrackKey'),
      fallbackResolvedTrackKey: (_index: number, row: Row) => row.id
    };
    const rebuild = Reflect.get(SmartListComponent.prototype, 'rebuildResolvedListTrackKeys') as (this: typeof component) => void;
    const keyFor = Reflect.get(SmartListComponent.prototype, 'resolvedListTrackKeyForItem') as (this: typeof component, index: number, row: Row) => string | number;
    rebuild.call(component);
    component.items = [{ ...second, value: 2 }, first];
    rebuild.call(component);

    expect(keyFor.call(component, 0, first)).toBe('first');
    expect(keyFor.call(component, 1, second)).toBe('second');
    expect(keyFor.call(component, 0, component.items[0])).toBe('second');
  });
});
