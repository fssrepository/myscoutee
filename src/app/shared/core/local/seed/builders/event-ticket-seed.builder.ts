import { AssetTicketBuilder } from '../../../base/builders';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type {
  EventTicketRecord,
  EventTicketRecordCollection
} from '../../source/entity/event-ticket.entity';

export class SeedEventTicketsBuilder {
  static buildRecordCollection(events: readonly ActivityEventRecord[]): EventTicketRecordCollection {
    const byId: Record<string, EventTicketRecord> = {};
    const ids: string[] = [];
    const eventsById = new Map<string, ActivityEventRecord>();
    for (const event of events) {
      const current = eventsById.get(event.id);
      if (!current || event.userId === event.creatorUserId) {
        eventsById.set(event.id, event);
      }
    }

    for (const event of eventsById.values()) {
      if (`${event.status ?? 'A'}`.trim() !== 'A' || event.ticketing !== true || event.trashedAtIso) {
        continue;
      }
      const adminIds = new Set([
        event.creatorUserId,
        ...(event.adminIds ?? [])
      ].map(id => id.trim()).filter(Boolean));
      const issuedAtIso = this.seedIssuedAtIso(event);
      for (const holderUserId of [...new Set(
        (event.acceptedMemberUserIds ?? []).map(id => id.trim()).filter(Boolean)
      )]) {
        if (adminIds.has(holderUserId)) {
          continue;
        }
        const idToken = AssetTicketBuilder.createDemoScanCode(
          `seed:${event.id}`,
          holderUserId
        ).slice('DEMO-'.length);
        const id = `seed-ticket-${idToken}`;
        byId[id] = {
          id,
          code: AssetTicketBuilder.createDemoScanCode(id, holderUserId),
          eventId: event.id,
          holderUserId,
          status: 'A',
          issuedAtIso,
          usedAtIso: null,
          usedByUserId: null
        };
        ids.push(id);
      }
    }
    return { byId, ids };
  }

  private static seedIssuedAtIso(event: ActivityEventRecord): string {
    const startAtMs = new Date(event.startAtIso).getTime();
    return Number.isFinite(startAtMs)
      ? new Date(startAtMs - 24 * 60 * 60 * 1000).toISOString()
      : new Date(0).toISOString();
  }
}
