import { describe, expect, it } from 'vitest';

import { canManageScopedAssetMembers } from './scoped-asset-member-management.policy';

describe('scoped Asset member management', () => {
  it('does not grant Asset actions from an unrelated Event-admin role', () => {
    expect(canManageScopedAssetMembers('casey', [
      { userId: 'nova', status: 'pending', role: 'Manager' }
    ])).toBe(false);
  });

  it('does not let a pending manager or accepted ordinary member manage the Asset', () => {
    expect(canManageScopedAssetMembers('casey', [
      { userId: 'casey', status: 'pending', role: 'Manager' }
    ])).toBe(false);
    expect(canManageScopedAssetMembers('casey', [
      { userId: 'casey', status: 'accepted', role: 'Member' }
    ])).toBe(false);
  });

  it('lets the accepted scoped Asset Manager manage its members', () => {
    expect(canManageScopedAssetMembers('casey', [
      { userId: 'casey', status: 'accepted', role: 'Manager' }
    ])).toBe(true);
  });
});
