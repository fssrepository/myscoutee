import '@angular/compiler';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { FollowingStore } from './following.store';
import type { FollowingChangeResult, FollowingState } from '../../../core/contracts/following.interface';

function setup(count: number) {
  const stateRef = signal<FollowingState>({ organizerIds: ['organizer'], eventCount: count });
  let resolve!: (result: FollowingChangeResult) => void;
  let reject!: (reason: Error) => void;
  const task = new Promise<FollowingChangeResult>((yes, no) => { resolve = yes; reject = no; });
  const host: any = { revision: 0, stateRef, profile: { activeUserId: () => 'viewer' }, service: { change: vi.fn(() => task) } };
  return { host, stateRef, resolve, reject };
}

describe('following committed state and delta', () => {
  it.each([
    [2, 3, 5], [5, -3, 2], [5, 0, 5], [0, 3, 5], [5, 3, 5]
  ])('reconciles starting %s with delta %s to %s only after save', async (before, delta, after) => {
    const { host, stateRef, resolve } = setup(before);
    const oldRevision = host.revision;
    const saving = FollowingStore.prototype.change.call(host, 'organizer', delta >= 0);
    expect(stateRef().eventCount).toBe(before);
    resolve({ organizerIds: ['organizer'], eventCount: after, eventCountDelta: delta });
    await saving;
    expect(stateRef().eventCount).toBe(after);
    FollowingStore.prototype.applySnapshot.call(host, 'viewer', { organizerIds: [], eventCount: 99 }, oldRevision);
    expect(stateRef().eventCount).toBe(after);
    expect(stateRef()).not.toHaveProperty('eventCountDelta');
  });
  it('does not remove relationship or decrement when save fails', async () => {
    const { host, stateRef, reject } = setup(3);
    const saving = FollowingStore.prototype.change.call(host, 'organizer', false);
    reject(new Error('Save failed'));
    await expect(saving).rejects.toThrow('Save failed');
    expect(stateRef()).toEqual({ organizerIds: ['organizer'], eventCount: 3 });
  });
});
