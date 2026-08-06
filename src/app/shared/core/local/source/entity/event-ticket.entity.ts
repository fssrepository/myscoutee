import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const EVENT_TICKETS_TABLE_NAME = APP_INDEXED_DB_KEYS.eventTickets;

export type EventTicketStatus = 'A' | 'D';

export interface EventTicketRecord {
  id: string;
  code: string;
  eventId: string;
  holderUserId: string;
  status: EventTicketStatus;
  issuedAtIso: string;
  usedAtIso: string | null;
  usedByUserId: string | null;
}

export interface EventTicketRecordCollection {
  byId: Record<string, EventTicketRecord>;
  ids: string[];
}

export type EventTicketsMemorySchema = Record<typeof EVENT_TICKETS_TABLE_NAME, EventTicketRecordCollection>;
