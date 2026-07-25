import { describe, expect, it } from 'vitest';

import { smartListItemByIdentity } from './smart-list-item-key';

describe('smartListItemByIdentity', () => {
  it('resolves the current cached item instead of a stale menu item', () => {
    const currentItems = [{ id: 'sub-event-1', pending: 1 }];

    expect(smartListItemByIdentity(
      currentItems,
      'sub-event-1',
      item => item.id
    )).toBe(currentItems[0]);
  });
});
