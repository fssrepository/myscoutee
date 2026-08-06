import { Injectable, inject } from '@angular/core';

import { AssetTicketBuilder } from '../../../base/builders';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalAssetTicketsMapper } from '../mappers/asset.mapper';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { LocalEventsRepository } from './events.repository';
import { LocalUsersRepository } from './users.repository';
import { LocalNotificationsRepository } from './notifications.repository';
import { ACTIVITY_MEMBERS_TABLE_NAME, type ActivityMemberRecord } from '../entity/activity.entity';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';
import {
  EVENT_TICKETS_TABLE_NAME,
  type EventTicketRecord,
  type EventTicketRecordCollection,
  type EventTicketReplayAuditRecord
} from '../entity/event-ticket.entity';
import type { NotificationRecord } from '../entity/notification.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';

import type { AppMemorySchema } from '../../common/memory.schema';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import type * as AssetContracts from '../../../contracts/asset.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalAssetTicketsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly notificationsRepository = inject(LocalNotificationsRepository);

  peekTicketCountByUser(userId: string): number {
    return this.visibleTicketRecordsByUser(userId).length;
  }

  async queryTicketPage(query: AssetContracts.AssetTicketPageQueryDTO): Promise<AssetContracts.AssetTicketPageResultDTO> {
    return LocalAssetTicketsMapper.pageRows(
      LocalAssetTicketsMapper.toTicketDTOs(this.visibleTicketRecordsByUser(query.userId)),
      query
    );
  }

  synchronizeForEvent(eventId: string, now = new Date()): void {
    const normalizedEventId = eventId.trim();
    const event = this.resolveEventRecord(normalizedEventId);
    if (!normalizedEventId || !event) {
      return;
    }
    const eligibleHolderIds = this.eligibleHolderUserIds(event);
    const issuedAtIso = now.toISOString();

    this.memoryDb.write(state => {
      const currentTable = state[EVENT_TICKETS_TABLE_NAME];
      const nextById = { ...currentTable.byId };
      const nextIds = [...currentTable.ids];
      const ticketingEnabled = event.ticketing === true;
      const affectedUserIds = new Set<string>([
        ...eligibleHolderIds,
        ...this.eventParticipantUserIds(event),
        ...nextIds
          .map(id => nextById[id])
          .filter(ticket => ticket?.eventId === normalizedEventId)
          .map(ticket => ticket.holderUserId)
      ]);

      for (const id of nextIds) {
        const ticket = nextById[id];
        if (!ticket || ticket.eventId !== normalizedEventId || ticket.status !== 'A') {
          continue;
        }
        if (!ticketingEnabled || !eligibleHolderIds.has(ticket.holderUserId)) {
          nextById[id] = { ...ticket, status: 'D' };
        }
      }

      if (ticketingEnabled && this.isPublished(event)) {
        for (const holderUserId of eligibleHolderIds) {
          const existingActive = nextIds
            .map(id => nextById[id])
            .some(ticket => ticket?.eventId === normalizedEventId
              && ticket.holderUserId === holderUserId
              && ticket.status === 'A');
          if (existingActive) {
            continue;
          }
          const ticket = this.createTicketRecord(
            normalizedEventId,
            holderUserId,
            issuedAtIso,
            nextIds.length
          );
          nextById[ticket.id] = ticket;
          nextIds.push(ticket.id);
        }
      }

      return this.withSynchronizedTicketCounters({
        ...state,
        [EVENT_TICKETS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      }, affectedUserIds);
    });
  }

  synchronizeForMemberChange(eventId: string, holderUserId: string, now = new Date()): void {
    const normalizedEventId = eventId.trim();
    const normalizedHolderUserId = holderUserId.trim();
    const event = this.resolveEventRecord(normalizedEventId, normalizedHolderUserId);
    if (!normalizedEventId || !normalizedHolderUserId || !event) {
      return;
    }
    const holderEligible = this.eligibleHolderUserIds(event).has(normalizedHolderUserId);
    const issuedAtIso = now.toISOString();

    this.memoryDb.write(state => {
      const currentTable = state[EVENT_TICKETS_TABLE_NAME];
      const nextById = { ...currentTable.byId };
      const nextIds = [...currentTable.ids];
      const activeTicket = nextIds
        .map(id => nextById[id])
        .find(ticket => ticket?.eventId === normalizedEventId
          && ticket.holderUserId === normalizedHolderUserId
          && ticket.status === 'A') ?? null;

      if ((!holderEligible || event.ticketing !== true) && activeTicket) {
        nextById[activeTicket.id] = { ...activeTicket, status: 'D' };
      } else if (holderEligible && event.ticketing === true && this.isPublished(event) && !activeTicket) {
        const ticket = this.createTicketRecord(
          normalizedEventId,
          normalizedHolderUserId,
          issuedAtIso,
          nextIds.length
        );
        nextById[ticket.id] = ticket;
        nextIds.push(ticket.id);
      }

      return this.withSynchronizedTicketCounters({
        ...state,
        [EVENT_TICKETS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds
        }
      }, new Set([normalizedHolderUserId]));
    });
  }

  validateTicket(
    request: AssetContracts.AssetTicketValidationRequestDTO
  ): AssetContracts.AssetTicketValidationDTO {
    const code = request.code.trim();
    const actorUserId = request.userId.trim();
    if (!AssetTicketBuilder.isDemoScanCode(code) || !actorUserId) {
      return this.invalid('invalid_code');
    }

    const ticket = this.ticketByScanCode(code);
    if (!ticket) {
      return this.invalid('not_found');
    }
    if (ticket.status === 'D') {
      return this.invalid('revoked');
    }

    const event = this.resolveEventRecord(ticket.eventId, ticket.holderUserId);
    if (!event) {
      return this.invalid('not_found');
    }
    if (!this.actorCanManageEvent(event, actorUserId)) {
      return this.invalid('not_authorized');
    }
    if (!this.isPublished(event) || !!event.trashedAtIso) {
      return this.invalid('event_unavailable');
    }
    if (event.ticketing !== true || !this.eligibleHolderUserIds(event).has(ticket.holderUserId)) {
      return this.invalid('revoked');
    }
    const endAtMs = new Date(event.endAtIso).getTime();
    if (!Number.isFinite(endAtMs) || endAtMs <= Date.now()) {
      return this.invalid('expired');
    }

    const holder = this.usersRepository.queryUserById(ticket.holderUserId);
    if (!holder || ['blocked', 'inactive', 'deleted'].includes(holder.profileStatus)) {
      return this.invalid('revoked');
    }
    if (ticket.usedAtIso) {
      const attemptedAtIso = new Date().toISOString();
      this.persistReplayAudit(ticket, actorUserId, attemptedAtIso);
      this.appendReplayWarning(ticket, event, actorUserId, attemptedAtIso);
      return this.invalid('already_used');
    }

    const usedAtIso = new Date().toISOString();
    const usedTicket = this.persistTicketCheckIn(ticket.id, actorUserId, usedAtIso);
    const ticketRow = LocalAssetTicketsMapper.toTicketDTOs([{ ticket: usedTicket, event }])[0];
    if (!ticketRow) {
      return this.invalid('revoked');
    }
    return {
      valid: true,
      reason: 'valid',
      ticket: AssetTicketBuilder.createScanPayload(ticketRow, holder)
    };
  }

  private visibleTicketRecordsByUser(
    userId: string
  ): Array<{ ticket: EventTicketRecord; event: ActivityEventRecord }> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[EVENT_TICKETS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((ticket): ticket is EventTicketRecord => Boolean(ticket)
        && ticket.status === 'A'
        && ticket.holderUserId === normalizedUserId)
      .map(ticket => ({ ticket, event: this.resolveEventRecord(ticket.eventId, normalizedUserId) }))
      .filter((pair): pair is { ticket: EventTicketRecord; event: ActivityEventRecord } => Boolean(pair.event))
      .filter(({ event }) => this.isPublished(event)
        && !event.trashedAtIso
        && event.ticketing === true
        && this.eligibleHolderUserIds(event).has(normalizedUserId));
  }

  private ticketByScanCode(code: string): EventTicketRecord | null {
    const table = this.memoryDb.read()[EVENT_TICKETS_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .find(ticket => ticket?.code === code) ?? null;
  }

  private persistTicketCheckIn(ticketId: string, actorUserId: string, usedAtIso: string): EventTicketRecord {
    let persisted: EventTicketRecord | null = null;
    this.memoryDb.write(state => {
      const table = state[EVENT_TICKETS_TABLE_NAME];
      const current = table.byId[ticketId];
      if (!current) {
        return state;
      }
      persisted = {
        ...current,
        usedAtIso,
        usedByUserId: actorUserId
      };
      return {
        ...state,
        [EVENT_TICKETS_TABLE_NAME]: {
          ...table,
          byId: {
            ...table.byId,
            [ticketId]: persisted
          }
        }
      };
    });
    return persisted ?? this.memoryDb.read()[EVENT_TICKETS_TABLE_NAME].byId[ticketId];
  }

  private persistReplayAudit(
    ticket: EventTicketRecord,
    actorUserId: string,
    attemptedAtIso: string
  ): void {
    const audit: EventTicketReplayAuditRecord = {
      id: `ticket-replay:${ticket.id}:${attemptedAtIso}:${actorUserId}`,
      action: 'check-in-replay',
      result: 'already_used',
      actorUserId,
      attemptedAtIso,
      originalUsedAtIso: `${ticket.usedAtIso ?? ''}`,
      originalUsedByUserId: `${ticket.usedByUserId ?? ''}`
    };
    this.memoryDb.write(state => {
      const table = state[EVENT_TICKETS_TABLE_NAME];
      const current = table.byId[ticket.id];
      if (!current) {
        return state;
      }
      return {
        ...state,
        [EVENT_TICKETS_TABLE_NAME]: {
          ...table,
          byId: {
            ...table.byId,
            [ticket.id]: {
              ...current,
              replayAudits: [...(current.replayAudits ?? []), audit]
            }
          }
        }
      };
    });
  }

  private appendReplayWarning(
    ticket: EventTicketRecord,
    event: ActivityEventRecord,
    actorUserId: string,
    attemptedAtIso: string
  ): void {
    const actor = this.usersRepository.queryUserById(actorUserId);
    const record: NotificationRecord = {
      id: `event-ticket-replay-warning:${ticket.id}:${ticket.holderUserId}`,
      recipientUserId: ticket.holderUserId,
      kind: 'event-ticket-replay-warning',
      category: 'event',
      title: 'Ticket reuse warning',
      message: 'notification.ticket.reuse.message',
      createdAtIso: attemptedAtIso,
      readAtIso: null,
      senderUserId: actorUserId,
      senderName: actor?.name ?? actorUserId,
      senderAvatarUrl: actor?.images?.[0] ?? null,
      actionPath: '/game',
      sourceType: 'event',
      sourceId: ticket.eventId,
      occurrenceCount: 1,
      payload: {
        eventId: ticket.eventId,
        eventTitle: event.title || 'Event',
        eventScope: 'tickets',
        ticketId: ticket.id,
        ticketStatus: 'already-used',
        usedAtIso: `${ticket.usedAtIso ?? ''}`,
        actorUserId,
        notification_message_key: 'notification.ticket.reuse.message',
        notification_tone: 'warning',
        notification_aggregation_key: `event-ticket-replay:${ticket.id}`
      }
    };
    this.notificationsRepository.appendAggregated(record);
  }

  private resolveEventRecord(eventId: string, preferredUserId = ''): ActivityEventRecord | null {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return null;
    }
    const records = this.memoryDb.read()[EVENTS_TABLE_NAME].ids
      .map(id => this.memoryDb.read()[EVENTS_TABLE_NAME].byId[id])
      .filter((record): record is ActivityEventRecord => Boolean(record) && record.id === normalizedEventId);
    return records.find(record => record.userId === preferredUserId)
      ?? records.find(record => record.userId === record.creatorUserId)
      ?? records[0]
      ?? null;
  }

  private eligibleHolderUserIds(event: ActivityEventRecord): Set<string> {
    const memberRecords = this.activityMembersRepository.peekRecordsByOwner({
      ownerType: 'event',
      ownerId: event.id
    });
    const adminIds = new Set<string>([
      event.creatorUserId,
      ...(event.adminIds ?? []),
      ...memberRecords
        .filter(member => member.role === 'Admin' || member.role === 'Manager')
        .map(member => member.userId)
    ].map(id => id.trim()).filter(Boolean));
    const acceptedIds = new Set<string>([
      ...(event.acceptedMemberUserIds ?? []),
      ...memberRecords
        .filter(member => member.status === 'accepted')
        .map(member => member.userId)
    ].map(id => id.trim()).filter(Boolean));
    for (const adminId of adminIds) {
      acceptedIds.delete(adminId);
    }
    return acceptedIds;
  }

  private eventParticipantUserIds(event: ActivityEventRecord): string[] {
    return [...new Set([
      event.creatorUserId,
      ...(event.adminIds ?? []),
      ...(event.acceptedMemberUserIds ?? []),
      ...(event.pendingMemberUserIds ?? []),
      ...this.eventMemberRecords(event.id).map(member => member.userId)
    ].map(id => id.trim()).filter(Boolean))];
  }

  private eventMemberRecords(eventId: string): ActivityMemberRecord[] {
    const table = this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME];
    return (table.idsByOwnerKey[`event:${eventId}`] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is ActivityMemberRecord => Boolean(record));
  }

  private actorCanManageEvent(event: ActivityEventRecord, actorUserId: string): boolean {
    if (event.creatorUserId === actorUserId || (event.adminIds ?? []).includes(actorUserId)) {
      return true;
    }
    return this.eventMemberRecords(event.id).some(member =>
      member.userId === actorUserId
      && member.status === 'accepted'
      && (member.role === 'Admin' || member.role === 'Manager'));
  }

  private createTicketRecord(
    eventId: string,
    holderUserId: string,
    issuedAtIso: string,
    sequence: number
  ): EventTicketRecord {
    const idToken = AssetTicketBuilder.createDemoScanCode(
      `${eventId}:${issuedAtIso}:${sequence}`,
      holderUserId
    ).slice('DEMO-'.length);
    const id = `local-ticket-${idToken}`;
    return {
      id,
      code: AssetTicketBuilder.createDemoScanCode(id, holderUserId),
      eventId,
      holderUserId,
      status: 'A',
      issuedAtIso,
      usedAtIso: null,
      usedByUserId: null
    };
  }

  private withSynchronizedTicketCounters(state: AppMemorySchema, affectedUserIds: ReadonlySet<string>): AppMemorySchema {
    const table = state[EVENT_TICKETS_TABLE_NAME];
    const eventsTable = state[EVENTS_TABLE_NAME];
    const usersTable = state[USERS_TABLE_NAME];
    const nextUsersById = { ...usersTable.byId };
    let changed = false;

    for (const userId of affectedUserIds) {
      const user = usersTable.byId[userId];
      if (!user) {
        continue;
      }
      const ticketCount = table.ids
        .map(id => table.byId[id])
        .filter(ticket => ticket?.status === 'A' && ticket.holderUserId === userId)
        .filter(ticket => eventsTable.ids.some(recordId => {
          const event = eventsTable.byId[recordId];
          return event?.id === ticket.eventId
            && this.isPublished(event)
            && event.ticketing === true
            && !event.trashedAtIso;
        })).length;
      if (user.activities.tickets === ticketCount && user.activities.asset?.tickets === ticketCount) {
        continue;
      }
      nextUsersById[userId] = {
        ...user,
        activities: {
          ...user.activities,
          tickets: ticketCount,
          asset: {
            ...(user.activities.asset ?? {}),
            tickets: ticketCount
          }
        }
      };
      changed = true;
    }
    return changed
      ? {
        ...state,
        [USERS_TABLE_NAME]: {
          ...usersTable,
          byId: nextUsersById
        }
      }
      : state;
  }

  private isPublished(event: ActivityEventRecord): boolean {
    return `${event.status ?? 'A'}`.trim() === 'A';
  }

  private invalid(reason: Exclude<AssetContracts.AssetTicketValidationReason, 'valid'>): AssetContracts.AssetTicketValidationDTO {
    return {
      valid: false,
      reason,
      ticket: null
    };
  }
}
