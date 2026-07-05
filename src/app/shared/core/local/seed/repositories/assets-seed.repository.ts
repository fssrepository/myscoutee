import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../../environments/environment';

import { AppUtils } from '../../../../app-utils';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../base/builders';
import { LocalMemoryDb } from '../../../common/app.db';
import {
  ASSET_REQUESTS_TABLE_NAME,
  ASSETS_TABLE_NAME,
  type AssetRequestRecord,
  type AssetRequestsRecordCollection,
  type AssetRecord,
  type AssetsRecordCollection
} from '../../source/entity/asset.entity';
import { LocalAssetsMapper } from '../../source/mappers/asset.mapper';
import type { UserRecord } from '../../source/entity/user.entity';
import { SeedAssetBuilder } from '../builders';
import { SEED_SCHEDULE_REFERENCE_DATE } from '../seed-constants';

import type * as AppConstants from '../../../common/constants';
import type * as AppDTOs from '../../../contracts';
@Injectable({
  providedIn: 'root'
})
export class SeedAssetsRepository {
  private static readonly DEFAULT_ASSET_LIMIT_PER_OWNER = 12;

  private readonly memoryDb = inject(LocalMemoryDb);
  private lastSeedToken = '';

  seedDefaults(ownerUserIds?: readonly string[], seedUsers: readonly UserRecord[] = []): Map<string, AppDTOs.AssetDTO[]> {
    const allUsers = seedUsers
      .filter(user => user.profileStatus === 'public');
    const normalizedOwnerIds = Array.from(new Set(
      (ownerUserIds ?? allUsers.map(user => user.id))
        .map(userId => `${userId ?? ''}`.trim())
        .filter(Boolean)
    ));
    if (normalizedOwnerIds.length === 0) {
      return new Map();
    }

    const currentState = this.memoryDb.read();
    const currentTable = this.normalizeCollection(currentState[ASSETS_TABLE_NAME]);
    const currentRequestsTable = this.normalizeRequestsCollection(currentState[ASSET_REQUESTS_TABLE_NAME]);
    const seedToken = `${currentTable.ids.length}:${normalizedOwnerIds.join('|')}`;
    if (this.lastSeedToken !== seedToken) {
      const nextTable = this.mergeSeededRecords(currentTable, currentRequestsTable, normalizedOwnerIds, allUsers);
      if (nextTable.changed) {
        this.memoryDb.write(state => ({
          ...state,
          [ASSETS_TABLE_NAME]: nextTable.assetsTable,
          [ASSET_REQUESTS_TABLE_NAME]: nextTable.requestsTable
        }));
      }
      this.lastSeedToken = seedToken;
    }

    return this.peekOwnedAssetsByUsers(normalizedOwnerIds);
  }

  peekOwnedAssetsByUsers(userIds: readonly string[]): Map<string, AppDTOs.AssetDTO[]> {
    const table = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const assetsByUserId = new Map<string, AppDTOs.AssetDTO[]>();
    for (const userId of userIds) {
      const normalizedUserId = `${userId ?? ''}`.trim();
      if (!normalizedUserId) {
        continue;
      }
      const assets = (table.idsByOwnerUserId[normalizedUserId] ?? [])
        .map(id => table.byId[id])
        .filter((record): record is AssetRecord => Boolean(record))
        .filter(record => !this.isSuppressedAssetStatus(record.status))
        .sort((left, right) => right.updatedMs - left.updatedMs)
        .map(record => this.toAssetCard(record));
      assetsByUserId.set(normalizedUserId, assets);
    }
    return assetsByUserId;
  }

  private mergeSeededRecords(
    currentTable: AssetsRecordCollection,
    currentRequestsTable: AssetRequestsRecordCollection,
    ownerUserIds: readonly string[],
    allUsers: readonly UserRecord[]
  ): { assetsTable: AssetsRecordCollection; requestsTable: AssetRequestsRecordCollection; changed: boolean } {
    const sampleCards = SeedAssetBuilder.buildSampleAssetCards(allUsers)
      .slice(0, SeedAssetsRepository.DEFAULT_ASSET_LIMIT_PER_OWNER);
    const usersById = new Map(allUsers.map(user => [user.id, user]));
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    const nextIdSet = new Set(nextIds);
    const nextIdsByOwnerUserId = this.cloneOwnerUserIdIndex(currentTable.idsByOwnerUserId);
    let nextRequestsTable = this.cloneRequestsCollection(currentRequestsTable);
    let changed = false;

    for (const ownerUserId of ownerUserIds) {
      const owner = usersById.get(ownerUserId);
      if (!owner) {
        continue;
      }
      const ownerBucket = nextIdsByOwnerUserId[ownerUserId] ?? [];
      const ownerIdSet = new Set(ownerBucket);
      const createdAt = AppUtils.shiftDate(
        new Date('2026-02-01T12:00:00.000Z'),
        SEED_SCHEDULE_REFERENCE_DATE,
        environment.bootstrapOffsetInDays
      );
      for (const [index, card] of sampleCards.entries()) {
        const id = `${ownerUserId}:${card.id}`;
        const seededRequests = this.seedAssetRequests(id, card, owner, allUsers, createdAt);
        for (const request of seededRequests) {
          const upserted = this.upsertAssetRequest(nextRequestsTable, request);
          nextRequestsTable = upserted.table;
          changed = upserted.changed || changed;
        }
        if (ownerIdSet.has(id)) {
          continue;
        }
        const createdMs = createdAt.getTime() + (index * 60_000);
        const createdAtIso = new Date(createdMs).toISOString();
        const imageUrl = SeedAssetBuilder.defaultAssetImage(card.type, `${ownerUserId}-${card.id}`);
        const record: AssetRecord = {
          ...card,
          id,
          category: AssetDefaultsBuilder.normalizeCategory(card.type, card.category),
          city: owner.city || card.city,
          imageUrl,
          sourceLink: '',
          ownerUserId,
          ownerName: owner.name,
          visibility: index % 3 === 0 ? 'Friends only' : 'Public',
          status: index === 0 ? 'UR' : index === 1 ? 'D' : 'A',
          statusBeforeSuppression: index === 0 || index === 1 ? 'A' : null,
          pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
          policies: (card.policies ?? []).map(policy => ({ ...policy })),
          requests: [],
          routes: [...(card.routes ?? [])],
          topics: [...(card.topics ?? [])],
          menuActions: [...(card.menuActions ?? [])],
          affinity: Math.max(0, Math.trunc(Number(owner.affinity) || 0)),
          boost: Math.max(0, 100 - index),
          createdAtIso,
          updatedAtIso: createdAtIso,
          createdMs,
          updatedMs: createdMs
        };
        nextById[id] = record;
        if (!nextIdSet.has(id)) {
          nextIds.unshift(id);
          nextIdSet.add(id);
        }
        ownerBucket.unshift(id);
        ownerIdSet.add(id);
        changed = true;
      }
      nextIdsByOwnerUserId[ownerUserId] = ownerBucket;
    }

    return {
      assetsTable: {
        byId: nextById,
        ids: nextIds,
        idsByOwnerUserId: nextIdsByOwnerUserId
      },
      requestsTable: nextRequestsTable,
      changed
    };
  }

  private toAssetCard(record: AssetRecord): AppDTOs.AssetDTO {
    return LocalAssetsMapper.toAssetDto(record);
  }

  private seedAssetRequests(
    assetId: string,
    card: AppDTOs.AssetDetailDTO,
    owner: UserRecord,
    allUsers: readonly UserRecord[],
    anchorDate: Date
  ): AssetRequestRecord[] {
    const members = allUsers
      .filter(user => user.id !== owner.id)
      .slice(0, 6);
    if (members.length === 0) {
      return [];
    }
    if (card.id === 'asset-sup-1') {
      return [
        this.seedAssetRequest(assetId, owner.id, card, 'camp-assigned-1', members[0], 'manual', 'accepted', anchorDate, 1, 9, 1, {
          quantity: 1,
          note: 'Reserved and assigned by the owner.',
          eventTitle: 'Trail Weekend',
          subEventTitle: 'Base camp setup'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'camp-borrow-1', members[1], 'borrow', 'accepted', anchorDate, 1, 10, 2, {
          quantity: 2,
          note: 'Borrow request approved by the owner.',
          eventTitle: 'Trail Weekend',
          subEventTitle: 'Overnight gear'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'camp-pending-1', members[2], 'borrow', 'pending', anchorDate, 1, 12, 1, {
          quantity: 1,
          note: 'Awaiting owner confirmation.',
          eventTitle: 'Trail Weekend',
          subEventTitle: 'Extra lamp'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'camp-borrow-2', members[3], 'borrow', 'accepted', anchorDate, 3, 14, 1, {
          quantity: 1,
          note: 'Approved and synced with the plan.',
          eventTitle: 'Lake Picnic',
          subEventTitle: 'Shelter kit'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'camp-pending-2', members[4] ?? members[0], 'borrow', 'pending', anchorDate, 6, 11, 2, {
          quantity: 2,
          note: 'Awaiting owner confirmation.',
          eventTitle: 'Outdoor Skills',
          subEventTitle: 'Tent handoff'
        })
      ];
    }
    if (card.id === 'asset-sup-3') {
      return [
        this.seedAssetRequest(assetId, owner.id, card, 'kitchen-borrow-1', members[1], 'borrow', 'accepted', anchorDate, 2, 8, 2, {
          quantity: 2,
          note: 'Borrow request approved by the owner.',
          eventTitle: 'Field Breakfast',
          subEventTitle: 'Cooking block'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'kitchen-pending-1', members[2], 'borrow', 'pending', anchorDate, 2, 10, 1, {
          quantity: 1,
          note: 'Awaiting owner confirmation.',
          eventTitle: 'Field Breakfast',
          subEventTitle: 'Serving tools'
        })
      ];
    }
    if (card.id === 'asset-car-3') {
      return [
        this.seedAssetRequest(assetId, owner.id, card, 'van-borrow-1', members[3] ?? members[0], 'borrow', 'accepted', anchorDate, 4, 7, 1, {
          quantity: 1,
          note: 'Borrow request approved by the owner.',
          eventTitle: 'Volunteer Run',
          subEventTitle: 'Morning transfer'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'van-pending-1', members[4] ?? members[1], 'borrow', 'pending', anchorDate, 4, 13, 1, {
          quantity: 1,
          note: 'Awaiting owner confirmation.',
          eventTitle: 'Volunteer Run',
          subEventTitle: 'Afternoon pickup'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'van-borrow-2', members[1], 'borrow', 'accepted', anchorDate, 6, 16, 2, {
          quantity: 1,
          note: 'Approved for the late volunteer transfer.',
          eventTitle: 'Crew Shuttle',
          subEventTitle: 'Evening return'
        })
      ];
    }
    if (card.id === 'asset-car-4') {
      return [
        this.seedAssetRequest(assetId, owner.id, card, 'summit-assigned-1', members[0], 'manual', 'accepted', anchorDate, 7, 8, 1, {
          quantity: 1,
          note: 'Assigned by the owner for the speaker transfer.',
          eventTitle: 'Summit Logistics',
          subEventTitle: 'Speaker pickup'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'summit-pending-1', members[2], 'borrow', 'pending', anchorDate, 7, 10, 1, {
          quantity: 1,
          note: 'Awaiting owner confirmation for the hotel return.',
          eventTitle: 'Summit Logistics',
          subEventTitle: 'Hotel return'
        }),
        this.seedAssetRequest(assetId, owner.id, card, 'summit-borrow-1', members[4] ?? members[1], 'borrow', 'accepted', anchorDate, 9, 15, 2, {
          quantity: 1,
          note: 'Borrow request approved for the afternoon transfer.',
          eventTitle: 'Partner Meetup',
          subEventTitle: 'Station transfer'
        })
      ];
    }
    return [];
  }

  private seedAssetRequest(
    assetId: string,
    ownerUserId: string,
    card: AppDTOs.AssetDetailDTO,
    requestKey: string,
    user: UserRecord,
    requestKind: AppConstants.AssetRequestKind,
    status: AppConstants.AssetRequestStatus,
    anchorDate: Date,
    offsetDays: number,
    hour: number,
    durationHours: number,
    options: {
      quantity: number;
      note: string;
      eventTitle: string;
      subEventTitle: string;
    }
  ): AssetRequestRecord {
    const start = this.seedRequestDate(anchorDate, offsetDays, hour);
    const end = new Date(start.getTime() + Math.max(1, durationHours) * 60 * 60 * 1000);
    const requestedAtIso = AppUtils.addDays(start, -1).toISOString();
    const createdMs = start.getTime() - 24 * 60 * 60 * 1000;
    return {
      id: `${assetId}:${requestKey}`,
      assetId,
      ownerUserId,
      ownerKey: this.assetRequestOwnerKey(assetId),
      assetCapacity: AssetCardBuilder.storedQuantityValue(card),
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      status,
      note: options.note,
      requestKind,
      requestedAtIso,
      booking: {
        eventId: `${requestKey}:event`,
        eventTitle: options.eventTitle,
        subEventId: `${requestKey}:sub-event`,
        subEventTitle: options.subEventTitle,
        slotKey: `${requestKey}:slot`,
        slotLabel: options.subEventTitle,
        timeframe: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        startAtIso: start.toISOString(),
        endAtIso: end.toISOString(),
        quantity: Math.max(1, Math.trunc(Number(options.quantity) || 1)),
        totalAmount: null,
        currency: null,
        acceptedPolicyIds: [],
        paymentSessionId: null,
        inventoryApplied: status === 'accepted' && requestKind !== 'manual'
      },
      menuActions: status === 'accepted' && requestKind !== 'manual' ? ['makeManager'] : [],
      createdMs,
      updatedMs: createdMs,
      createdAtIso: requestedAtIso,
      updatedAtIso: requestedAtIso
    };
  }

  private seedRequestDate(anchorDate: Date, offsetDays: number, hour: number): Date {
    const date = AppUtils.addDays(anchorDate, offsetDays);
    date.setHours(Math.max(0, Math.min(23, Math.trunc(hour))), 0, 0, 0);
    return date;
  }

  private cloneAssetRequest(request: AssetRequestRecord): AssetRequestRecord {
    return {
      ...request,
      booking: request.booking
        ? {
            ...request.booking,
            acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
          }
        : null,
      menuActions: [...(request.menuActions ?? [])]
    };
  }

  private normalizeCollection(value: unknown): AssetsRecordCollection {
    const source = value as Partial<AssetsRecordCollection> | null | undefined;
    return {
      byId: source?.byId && typeof source.byId === 'object'
        ? { ...(source.byId as Record<string, AssetRecord>) }
        : {},
      ids: Array.isArray(source?.ids)
        ? source.ids.map(id => String(id)).filter(Boolean)
        : [],
      idsByOwnerUserId: this.cloneOwnerUserIdIndex(source?.idsByOwnerUserId)
    };
  }

  private normalizeRequestsCollection(value: unknown): AssetRequestsRecordCollection {
    const source = value as Partial<AssetRequestsRecordCollection> | null | undefined;
    return {
      byId: source?.byId && typeof source.byId === 'object'
        ? { ...(source.byId as Record<string, AssetRequestRecord>) }
        : {},
      ids: Array.isArray(source?.ids)
        ? source.ids.map(id => String(id)).filter(Boolean)
        : [],
      idsByOwnerKey: this.cloneOwnerUserIdIndex(source?.idsByOwnerKey)
    };
  }

  private cloneRequestsCollection(table: AssetRequestsRecordCollection): AssetRequestsRecordCollection {
    return {
      byId: Object.fromEntries(
        Object.entries(table.byId).map(([id, request]) => [id, this.cloneAssetRequest(request)])
      ),
      ids: [...table.ids],
      idsByOwnerKey: this.cloneOwnerUserIdIndex(table.idsByOwnerKey)
    };
  }

  private upsertAssetRequest(
    table: AssetRequestsRecordCollection,
    request: AssetRequestRecord
  ): { table: AssetRequestsRecordCollection; changed: boolean } {
    const existing = table.byId[request.id];
    if (existing && existing.updatedAtIso === request.updatedAtIso) {
      return { table, changed: false };
    }
    const nextById = {
      ...table.byId,
      [request.id]: this.cloneAssetRequest(request)
    };
    const nextIds = table.ids.includes(request.id) ? [...table.ids] : [request.id, ...table.ids];
    const nextIdsByOwnerKey = this.cloneOwnerUserIdIndex(table.idsByOwnerKey);
    const ownerBucket = nextIdsByOwnerKey[request.ownerKey] ?? [];
    nextIdsByOwnerKey[request.ownerKey] = ownerBucket.includes(request.id)
      ? [...ownerBucket]
      : [request.id, ...ownerBucket];
    return {
      table: {
        byId: nextById,
        ids: nextIds,
        idsByOwnerKey: nextIdsByOwnerKey
      },
      changed: true
    };
  }

  private assetRequestOwnerKey(assetId: string): string {
    return `asset:${assetId.trim()}`;
  }

  private cloneOwnerUserIdIndex(value: Record<string, readonly string[] | string[] | undefined> | undefined): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerUserId, ids] of Object.entries(value ?? {})) {
      const normalizedOwnerUserId = ownerUserId.trim();
      if (!normalizedOwnerUserId || !Array.isArray(ids)) {
        continue;
      }
      next[normalizedOwnerUserId] = ids.map(id => String(id)).filter(Boolean);
    }
    return next;
  }

  private isSuppressedAssetStatus(status: string | null | undefined): boolean {
    const normalized = `${status ?? ''}`.trim();
    return normalized === 'UR' || normalized === 'B' || normalized === 'D' || normalized === 'I' || normalized === 'T';
  }
}
