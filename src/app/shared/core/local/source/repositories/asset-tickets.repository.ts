import { Injectable, inject } from '@angular/core';

import { AssetTicketBuilder } from '../../../base/builders';
import { LocalMemoryDb } from '../../../common/app.db';
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
    const parsedCode = AssetTicketBuilder.parseDemoScanCode(code);
    if (!parsedCode || !actorUserId) {
      return this.invalid('invalid_code');
    }

    const event = this.eventsRepository.queryEventRecordById(actorUserId, parsedCode.eventId);
    if (!event) {
      return this.invalid('not_found');
    }
    const actorCanManage = event.creatorUserId === actorUserId
      || (event.adminIds ?? []).some(adminId => `${adminId ?? ''}`.trim() === actorUserId);
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

    const holder = this.usersRepository.queryUserById(parsedCode.holderUserId);
    if (!holder || ['blocked', 'inactive', 'deleted'].includes(holder.profileStatus)) {
      return this.invalid('revoked');
    }
    const holderEvent = [
      ...this.eventsRepository.queryFeedbackCandidateItemsByUser(parsedCode.holderUserId),
      ...this.eventsRepository.queryHostingItemsByUser(parsedCode.holderUserId)
    ].find(record => record.id === event.id);
    if (!holderEvent) {
      return this.invalid('revoked');
    }

    const currentUsedAtIso = `${event.ticketCheckInsByHolderUserId?.[parsedCode.holderUserId] ?? ''}`.trim();
    if (currentUsedAtIso) {
      return this.invalid('already_used');
    }

    const ticketRow = LocalAssetTicketsMapper.toTicketDTOs([holderEvent])
      .find(row => row.id === event.id && row.holderUserId === parsedCode.holderUserId);
    if (!ticketRow || ticketRow.scanCode !== code) {
      return this.invalid('not_found');
    }

    const usedAtIso = new Date().toISOString();
    this.persistTicketCheckIn(event.id, parsedCode.holderUserId, usedAtIso);
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
