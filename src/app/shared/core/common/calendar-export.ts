import type { ActivityEventDTO } from '../contracts/activity.interface';

/** Same private snapshot contract as CalendarExportService (HTTP); local/demo adapter only. */
export function renderCalendarExport(actorId: string, records: readonly ActivityEventDTO[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MyScoutee//Calendar Export//EN', 'CALSCALE:GREGORIAN'];
  const unique = new Map<string, ActivityEventDTO>();
  for (const event of records) {
    const start = instant(event.startAtIso);
    const end = instant(event.endAtIso);
    const owner = event.creatorUserId === actorId || event.organizerUserId === actorId;
    if (event.status !== 'A' || (!owner && event.currentUserMembershipStatus !== 'accepted')
      || !event.id?.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= now.getTime()) continue;
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  for (const event of [...unique.values()].sort((a, b) => instant(a.startAtIso) - instant(b.startAtIso))) {
    const uid = btoa(Array.from(new TextEncoder().encode(`myscoutee:event:${event.id}`), byte => String.fromCharCode(byte)).join(''))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    lines.push('BEGIN:VEVENT', `UID:${uid}@myscoutee`, `DTSTAMP:${stamp(now.getTime())}`,
      `DTSTART:${stamp(instant(event.startAtIso))}`, `DTEND:${stamp(instant(event.endAtIso))}`,
      `SUMMARY:${escapeText(event.title)}`, `LOCATION:${escapeText(event.location)}`, 'STATUS:CONFIRMED',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0S', `DESCRIPTION:${escapeText(event.title)}`,
      'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

function instant(value: string): number {
  // A floating browser-local timestamp would disagree with the HTTP export.
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value ?? '') ? Date.parse(value) : NaN;
}
function stamp(value: number): string { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
function escapeText(value: string): string {
  return (value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
function fold(value: string): string {
  let output = '', octets = 0;
  for (const character of value) {
    const size = new TextEncoder().encode(character).length;
    if (octets + size > 75) { output += '\r\n '; octets = 1; }
    output += character; octets += size;
  }
  return output;
}
