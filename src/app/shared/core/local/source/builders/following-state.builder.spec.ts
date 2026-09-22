import { describe, expect, it } from 'vitest';
import { isCurrentFollowedEvent } from './following-state.builder';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
const now = Date.parse('2026-09-22T12:00:00Z');
const event = { id: 'one', status: 'A', creatorUserId: 'organizer', visibility: 'Public',
  startAtIso: '2026-09-22T11:00:00Z', endAtIso: '2026-09-22T13:00:00Z' } as ActivityEventRecord;
describe('followed current events', () => {
  it('includes a running event', () => expect(isCurrentFollowedEvent(event, 'viewer', now)).toBe(true));
  it('expires exactly at its end', () => expect(isCurrentFollowedEvent(event, 'viewer', Date.parse(event.endAtIso))).toBe(false));
  it.each(['DR', 'T', 'D', 'I', 'B', 'UR'])('excludes status %s', status =>
    expect(isCurrentFollowedEvent({ ...event, status } as ActivityEventRecord, 'viewer', now)).toBe(false));
  it('excludes private events and generated tables', () => {
    expect(isCurrentFollowedEvent({ ...event, visibility: 'Invitation only' }, 'viewer', now)).toBe(false);
    expect(isCurrentFollowedEvent({ ...event, generated: true }, 'viewer', now)).toBe(false);
  });
});
