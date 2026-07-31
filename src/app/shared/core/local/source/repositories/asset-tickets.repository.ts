import { Injectable, inject } from '@angular/core';

import { AssetTicketBuilder } from '../../../base/builders';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalActivityMembersRepository } from './activity-members.repository';
import { LocalEventsRepository } from './events.repository';
import { LocalUsersRepository } from './users.repository';
import { LocalAssetTicketsMapper } from '../mappers/asset.mapper';
import { EVENTS_TABLE_NAME } from '../entity/event.entity';

import type * as AssetContracts from '../../../contracts/asset.interface';
@Injectable({
  providedIn: 'root'
})
export class LocalAssetTicketsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);

  peekTicketCountByUser(userId: string): number {
    return LocalAssetTicketsMapper.toTicketDTOs(this.ticketRecordsByUser(userId)).length;
  }

  async queryTicketPage(query: AssetContracts.AssetTicketPageQueryDTO): Promise<AssetContracts.AssetTicketPageResultDTO> {
    return LocalAssetTicketsMapper.pageRows(
      LocalAssetTicketsMapper.toTicketDTOs(this.ticketRecordsByUser(query.userId)),
      query
    );
  }

  validateTicket(
    request: AssetContracts.AssetTicketValidationRequestDTO
  ): AssetContracts.AssetTicketValidationDTO {
    const code = request.code.trim();
    const actorUserId = request.userId.trim();
    if (!AssetTicketBuilder.isDemoScanCode(code) || !actorUserId) {
      return this.invalid('invalid_code');
    }

    const resolvedTicket = this.resolveTicketByScanCode(code);
    if (!resolvedTicket) {
      return this.invalid('not_found');
    }
    const { holder, holderEvent } = resolvedTicket;
    const event = this.eventsRepository.queryEventRecordById(actorUserId, holderEvent.id);
    if (!event) {
      return this.invalid('not_found');
    }
    const actorCanManage = event.creatorUserId === actorUserId
      || (event.adminIds ?? []).some(adminId => `${adminId ?? ''}`.trim() === actorUserId)
      || this.activityMembersRepository.peekRecordsByOwner({
        ownerType: 'event',
        ownerId: event.id
      }).some(member =>
        member.userId.trim() === actorUserId
        && member.status === 'accepted'
        && (member.role === 'Admin' || member.role === 'Manager')
      );
    if (!actorCanManage) {
      return this.invalid('not_authorized');
    }
    if (`${event.status ?? 'A'}`.trim() !== 'A' || !!event.trashedAtIso) {
      return this.invalid('event_unavailable');
    }
    if (event.ticketing !== true) {
      return this.invalid('revoked');
    }
    const endAtMs = new Date(event.endAtIso).getTime();
    if (!Number.isFinite(endAtMs) || endAtMs <= Date.now()) {
      return this.invalid('expired');
    }

    if (!holder || ['blocked', 'inactive', 'deleted'].includes(holder.profileStatus)) {
      return this.invalid('revoked');
    }

    const ticketRow = LocalAssetTicketsMapper.toTicketDTOs([holderEvent])
      .find(row => row.id === event.id && row.holderUserId === holder.id);
    if (!ticketRow || ticketRow.scanCode !== code) {
      return this.invalid('revoked');
    }

    const currentUsedAtIso = `${event.ticketCheckInsByHolderUserId?.[ticketRow.holderUserId] ?? ''}`.trim();
    if (currentUsedAtIso) {
      return this.invalid('already_used');
    }

    const usedAtIso = new Date().toISOString();
    this.persistTicketCheckIn(event.id, ticketRow.holderUserId, usedAtIso);
    const ticket = AssetTicketBuilder.createScanPayload(
      { ...ticketRow, usedAtIso },
      holder
    );
    return {
      valid: true,
      reason: 'valid',
      ticket
    };
  }

  private ticketRecordsByUser(userId: string) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return [
      ...this.eventsRepository.queryFeedbackCandidateItemsByUser(normalizedUserId),
      ...this.eventsRepository.queryHostingItemsByUser(normalizedUserId)
    ].filter(record => `${record.status ?? 'A'}`.trim() === 'A');
  }

  private resolveTicketByScanCode(code: string): {
    holder: NonNullable<ReturnType<LocalUsersRepository['queryUserById']>>;
    holderEvent: NonNullable<ReturnType<LocalEventsRepository['queryEventRecordById']>>;
  } | null {
    for (const user of this.usersRepository.queryAllUsers()) {
      const holder = this.usersRepository.queryUserById(user.id);
      if (!holder) {
        continue;
      }
      const holderEvent = [
        ...this.eventsRepository.queryFeedbackCandidateItemsByUser(user.id),
        ...this.eventsRepository.queryHostingItemsByUser(user.id)
      ].find(record => AssetTicketBuilder.createDemoScanCode(record.id, user.id) === code);
      if (holderEvent) {
        return { holder, holderEvent };
      }
    }
    return null;
  }

  private persistTicketCheckIn(eventId: string, holderUserId: string, usedAtIso: string): void {
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      let changed = false;
      for (const recordKey of table.ids) {
        const record = table.byId[recordKey];
        if (!record || record.id !== eventId) {
          continue;
        }
        nextById[recordKey] = {
          ...record,
          ticketCheckInsByHolderUserId: {
            ...(record.ticketCheckInsByHolderUserId ?? {}),
            [holderUserId]: usedAtIso
          }
        };
        changed = true;
      }
      return changed
        ? {
          ...state,
          [EVENTS_TABLE_NAME]: {
            ...table,
            byId: nextById
          }
        }
        : state;
    });
  }

  private invalid(reason: Exclude<AssetContracts.AssetTicketValidationReason, 'valid'>): AssetContracts.AssetTicketValidationDTO {
    return {
      valid: false,
      reason,
      ticket: null
    };
  }
}
