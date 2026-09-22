import { describe, it, expect } from 'vitest';
import { renderCalendarExport } from './calendar-export';
import type { ActivityEventDTO } from '../contracts/activity.interface';

const now = new Date('2026-09-23T08:00:00Z');
const event = (overrides: Partial<ActivityEventDTO> = {}): ActivityEventDTO => ({
  id: 'event-1', status: 'A', creatorUserId: 'owner', currentUserMembershipStatus: 'accepted',
  title: 'Coffee', location: 'Budapest', startAtIso: '2026-09-24T10:00:00+02:00', endAtIso: '2026-09-24T11:00:00+02:00',
  ...overrides
} as ActivityEventDTO);
const uid = (text: string) => text.split('\r\n').find(line => line.startsWith('UID:'));

describe('Manual calendar snapshot', () => {
  it('deduplicates and preserves UID on changed times; exports UTC and an event-start reminder', () => {
    const initial = renderCalendarExport('viewer', [event(), event()], now);
    expect(initial.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(initial).toContain('DTSTART:20260924T080000Z\r\n');
    expect(initial).toContain('TRIGGER:PT0S\r\n');
    const changed = renderCalendarExport('viewer', [event({ startAtIso: '2026-09-24T08:30:00Z' })], now);
    expect(uid(changed)).toBe(uid(initial));
    expect(changed).toContain('DTSTART:20260924T083000Z');
    expect(initial).not.toMatch(/ATTENDEE|ORGANIZER/);
  });
  it('excludes drafts, trash, moderation states, unaccepted and invalid/past events', () => {
    const records = ['DR', 'T', 'UR', 'B', 'D', 'I'].map(status => event({ status: status as ActivityEventDTO['status'] }));
    records.push(...['pending', 'invited', 'none', 'deleted', 'suppressed'].map(currentUserMembershipStatus =>
      event({ currentUserMembershipStatus: currentUserMembershipStatus as ActivityEventDTO['currentUserMembershipStatus'] })));
    records.push(event({ endAtIso: '2026-09-23T07:00:00Z' }), event({ startAtIso: '2026-09-24T10:00:00' }));
    expect(renderCalendarExport('viewer', records, now)).not.toContain('BEGIN:VEVENT');
    expect(renderCalendarExport('owner', [event({ currentUserMembershipStatus: 'none' })], now)).toContain('BEGIN:VEVENT');
  });
  it('escapes injected properties and preserves Unicode with RFC byte folding', () => {
    const output = renderCalendarExport('viewer', [event({ title: 'Á😀'.repeat(40) + ',;\\\r\nBEGIN:VEVENT\0' })], now);
    for (const line of output.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(output.match(/\r\nBEGIN:VEVENT\r\n/g)).toHaveLength(1);
    expect(output.replace(/\r\n /g, '')).toContain('\\,\\;\\\\\\nBEGIN:VEVENT');
    expect(output).not.toContain('\0');
  });
});
