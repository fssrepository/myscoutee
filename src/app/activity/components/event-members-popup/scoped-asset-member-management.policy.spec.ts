import { describe, expect, it } from 'vitest';

import { canManageScopedAssetMembers } from './scoped-asset-member-management.policy';

describe('scoped Asset member management', () => {
  it('does not grant Asset actions from an unrelated Event-admin role', () => {
    expect(canManageScopedAssetMembers('casey', [
      { userId: 'nova', status: 'pending', role: 'Manager' }
    ])).toBe(false);
  });

  it('does not let an accepted ordinary member manage the Asset', () => {
    expect(canManageScopedAssetMembers('casey', [
      { userId: 'casey', status: 'accepted', role: 'Member' }
    ])).toBe(false);
  });

  it.each(['pending', 'accepted'])('lets the assigned scoped Asset Manager manage its members while %s', status => {
    expect(canManageScopedAssetMembers('casey', [
      { userId: 'casey', status: status as 'pending' | 'accepted', role: 'Manager' }
    ])).toBe(true);
  });
});
