import { EVENTS_TABLE_NAME } from '../../source/entity/event.entity';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../../environments/environment';

import { AppUtils } from '../../../../app-utils';
import { ActivityResourceBuilder } from '../../../base/builders';
import { LocalMemoryDb } from '../../../common/app.db';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../source/entity/activity.entity';
import { ACTIVITY_RESOURCES_TABLE_NAME, type ActivityResourcesRecordCollection, type ActivitySubEventResourceRecord } from '../../source/entity/activity.entity';
import { ASSETS_TABLE_NAME, type AssetRecord, type AssetsRecordCollection } from '../../source/entity/asset.entity';
import { LocalAssetsMapper } from '../../source/mappers/asset.mapper';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';

import type * as AppDTOs from '../../../contracts';
@Injectable({
  providedIn: 'root'
})
export class SeedActivityResourcesRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private lastSeedToken = '';

  seedDefaults(
    ownerUserIds?: readonly string[],
    sourceRecordsByUserId?: ReadonlyMap<string, readonly ActivityEventRecord[]>,
    assetsByUserId?: ReadonlyMap<string, readonly AppDTOs.AssetDTO[]>
  ): void {
    const normalizedUserIds = Array.from(new Set(
      (ownerUserIds ?? [])
        .map(userId => `${userId ?? ''}`.trim())
        .filter(userId => userId.length > 0)
    ));
    if (normalizedUserIds.length === 0) {
      return;
    }

    const state = this.memoryDb.read();
    const eventsTable = state[EVENTS_TABLE_NAME];
    const currentTable = this.normalizeCollection(state[ACTIVITY_RESOURCES_TABLE_NAME]);
    const seedToken = [
      eventsTable.ids.length,
      currentTable.ids.length,
      Object.keys(currentTable.idsByOwnerKey).length,
      normalizedUserIds.join('|')
    ].join(':');
    if (this.lastSeedToken === seedToken) {
      return;
    }

    const ownedAssetsByUserId = assetsByUserId ?? this.readOwnedAssetsByUsers(normalizedUserIds);
    const sourceRecords = sourceRecordsByUserId ?? this.collectSourceRecordsByUserId(normalizedUserIds);
    const contributorUserIdsByEventId = new Map<string, string[]>();
    const desiredRecords = normalizedUserIds.flatMap(userId =>
      this.buildSeededRecordsForUser(
        userId,
        sourceRecords.get(userId),
        ownedAssetsByUserId.get(userId),
        contributorUserIdsByEventId
      )
    );
    const desiredRecordIds = new Set(desiredRecords.map(record => record.id));
    const managedUserIds = new Set(normalizedUserIds);
    const nextRecords: ActivitySubEventResourceRecord[] = [];
    const retainedRecordIds = new Set<string>();
    let changed = false;

    for (const id of currentTable.ids) {
      const record = currentTable.byId[id];
      if (!record || retainedRecordIds.has(record.id)) {
        continue;
      }
      const belongsManagedUser = managedUserIds.has(record.assetOwnerUserId);
      if (belongsManagedUser && !desiredRecordIds.has(record.id)) {
        changed = true;
        continue;
      }
      nextRecords.push(this.cloneRecord(record));
      retainedRecordIds.add(record.id);
    }

    for (const record of desiredRecords) {
      if (retainedRecordIds.has(record.id)) {
        continue;
      }
      nextRecords.push(this.cloneRecord(record));
      retainedRecordIds.add(record.id);
      changed = true;
    }

    if (!changed) {
      this.lastSeedToken = seedToken;
      return;
    }

    const nextTable = this.buildCollection(nextRecords);
    const nextAssetsTable = this.syncManualRequestsInAssetsTable(
      this.normalizeAssetsCollection(state[ASSETS_TABLE_NAME]),
      nextRecords,
      new Map(eventsTable.ids.map(id => [eventsTable.byId[id]?.id ?? id, eventsTable.byId[id]]))
    );

    this.memoryDb.write(currentState => ({
      ...currentState,
      [ACTIVITY_RESOURCES_TABLE_NAME]: nextTable,
      [ASSETS_TABLE_NAME]: nextAssetsTable
    }));

    this.lastSeedToken = [
      eventsTable.ids.length,
      nextTable.ids.length,
      Object.keys(nextTable.idsByOwnerKey).length,
      normalizedUserIds.join('|')
    ].join(':');
  }

  private buildSeededRecordsForUser(
    userId: string,
    seedSourceRecords?: readonly ActivityEventRecord[],
    seedAssets?: readonly AppDTOs.AssetDTO[],
    contributorUserIdsByEventId?: Map<string, string[]>
  ): ActivitySubEventResourceRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const assets = seedAssets ?? [];
    const sourceRecords = seedSourceRecords ?? [];
    const seenRecordIds = new Set<string>();
    const nextRecords: ActivitySubEventResourceRecord[] = [];
    let createdMs = AppUtils.anchorDate(environment.bootstrapOffsetInDays).getTime();

    for (const record of sourceRecords) {
      if (!this.shouldSeedResourcesForParticipant(record, normalizedUserId, contributorUserIdsByEventId)) {
        continue;
      }
      for (const subEvent of record.subEvents ?? []) {
        const normalizedRef = this.normalizeRef({
          ownerId: record.id,
          subEventId: subEvent.id,
          assetOwnerUserId: normalizedUserId
        });
        if (!normalizedRef) {
          continue;
        }
        const recordId = ActivityResourceBuilder.recordId(normalizedRef);
        if (seenRecordIds.has(recordId)) {
          continue;
        }
        seenRecordIds.add(recordId);
        const seededState = ActivityResourceBuilder.buildSeededState(normalizedRef, assets);
        const createdAtIso = new Date(createdMs).toISOString();
        nextRecords.push({
          id: recordId,
          ownerKey: ActivityResourceBuilder.ownerKey(normalizedRef),
          ownerId: normalizedRef.ownerId,
          subEventId: normalizedRef.subEventId,
          assetOwnerUserId: normalizedRef.assetOwnerUserId,
          assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(seededState.assetAssignmentIds),
          assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(seededState.assetSettingsByType),
          supplyContributionEntriesByAssetId: {},
          fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(seededState.fallbackAssetCardsByType),
          createdMs,
          updatedMs: createdMs,
          createdAtIso,
          updatedAtIso: createdAtIso
        });
        createdMs += 1;
      }
    }

    return nextRecords;
  }

  private shouldSeedResourcesForParticipant(
    record: ActivityEventRecord,
    userId: string,
    contributorUserIdsByEventId?: Map<string, string[]>
  ): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    let contributorUserIds = contributorUserIdsByEventId?.get(record.id);
    if (!contributorUserIds) {
      contributorUserIds = this.resolveSeededResourceContributorUserIds(record);
      contributorUserIdsByEventId?.set(record.id, contributorUserIds);
    }
    return contributorUserIds.includes(normalizedUserId);
  }

  private resolveSeededResourceContributorUserIds(record: ActivityEventRecord): string[] {
    const creatorUserId = `${record.creatorUserId ?? ''}`.trim();
    const membersTable = this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME];
    const acceptedMemberUserIds = (membersTable.idsByOwnerKey[`event:${record.id}`] ?? [])
      .map(id => membersTable.byId[id])
      .filter(member => member?.status === 'accepted')
      .map(member => `${member?.userId ?? ''}`.trim())
      .filter(userId => userId.length > 0);
    const candidateUserIds = Array.from(new Set([
      creatorUserId,
      ...acceptedMemberUserIds
    ].filter(userId => userId.length > 0)));
    if (candidateUserIds.length <= 1) {
      return candidateUserIds;
    }
    const targetCount = this.resolveSeededResourceContributorTarget(record, candidateUserIds.length);
    if (targetCount >= candidateUserIds.length) {
      return candidateUserIds;
    }
    return [...candidateUserIds]
      .sort((left, right) => {
        if (left === creatorUserId && right !== creatorUserId) {
          return -1;
        }
        if (right === creatorUserId && left !== creatorUserId) {
          return 1;
        }
        const leftWeight = AppUtils.hashText(`activity-resource:${record.id}:${left}`);
        const rightWeight = AppUtils.hashText(`activity-resource:${record.id}:${right}`);
        return leftWeight - rightWeight;
      })
      .slice(0, targetCount);
  }

  private resolveSeededResourceContributorTarget(record: ActivityEventRecord, maxCount: number): number {
    if (maxCount <= 1) {
      return maxCount;
    }
    const seed = AppUtils.hashText(`activity-resource-target:${record.id}:${record.creatorUserId}:${record.activity}`);
    const bucket = seed % 100;
    let target = 1 + (seed % 2);
    if (bucket >= 65 && bucket < 88) {
      target = 2 + ((seed >> 3) % 3);
    } else if (bucket >= 88 && bucket < 97) {
      target = 4 + ((seed >> 5) % 3);
    } else if (bucket >= 97) {
      target = 10 + ((seed >> 7) % 4);
    }
    return Math.max(1, Math.min(maxCount, target));
  }

  private collectSourceRecordsByUserId(userIds: readonly string[]): Map<string, ActivityEventRecord[]> {
    const eventsTable = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const recordsByUserId = new Map<string, ActivityEventRecord[]>();
    for (const userId of userIds) {
      const sourceRecordsByEventId = new Map<string, ActivityEventRecord>();
      for (const id of eventsTable.ids) {
        const record = eventsTable.byId[id];
        if (
          !record
          || !record.id
          || (record.subEvents?.length ?? 0) === 0
          || record.status === 'T'
          || !this.isEventAdminRecord(record, userId)
        ) {
          continue;
        }
        const current = sourceRecordsByEventId.get(record.id);
        if (!current || this.shouldPreferParticipantSourceRecord(record, current)) {
          sourceRecordsByEventId.set(record.id, record);
        }
      }
      recordsByUserId.set(userId, [...sourceRecordsByEventId.values()]);
    }
    return recordsByUserId;
  }

  private shouldPreferParticipantSourceRecord(next: ActivityEventRecord, current: ActivityEventRecord): boolean {
    const nextPublished = this.isPublishedEventStatus(next.status);
    const currentPublished = this.isPublishedEventStatus(current.status);
    if (nextPublished !== currentPublished) {
      return nextPublished;
    }
    return next.activity >= current.activity;
  }

  private isEventAdminRecord(record: ActivityEventRecord, userId: string): boolean {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return false;
    }
    return this.normalizeUserIds([record.creatorUserId, ...(record.adminIds ?? [])]).includes(normalizedUserId);
  }

  private normalizeUserIds(userIds: readonly string[] | undefined): string[] {
    return Array.from(new Set((userIds ?? [])
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
  }

  private isPublishedEventStatus(status: ActivityEventRecord['status'] | null | undefined): boolean {
    return `${status ?? 'A'}`.trim() === 'A';
  }

  private readOwnedAssetsByUsers(userIds: readonly string[]): Map<string, AppDTOs.AssetDTO[]> {
    const table = this.normalizeAssetsCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const assetsByUserId = new Map<string, AppDTOs.AssetDTO[]>();
    for (const userId of userIds) {
      assetsByUserId.set(
        userId,
        (table.idsByOwnerUserId[userId] ?? [])
          .map(id => table.byId[id])
          .filter((record): record is AssetRecord => Boolean(record))
          .map(record => LocalAssetsMapper.toAssetDto(record))
      );
    }
    return assetsByUserId;
  }

  private buildCollection(records: readonly ActivitySubEventResourceRecord[]): ActivityResourcesRecordCollection {
    const byId: Record<string, ActivitySubEventResourceRecord> = {};
    const ids: string[] = [];
    const idsByOwnerKey: Record<string, string[]> = {};
    for (const record of records) {
      byId[record.id] = this.cloneRecord(record);
      ids.push(record.id);
      const ownerBucket = idsByOwnerKey[record.ownerKey] ?? [];
      ownerBucket.push(record.id);
      idsByOwnerKey[record.ownerKey] = ownerBucket;
    }
    return { byId, ids, idsByOwnerKey };
  }

  private normalizeCollection(value: unknown): ActivityResourcesRecordCollection {
    const source = value as Partial<ActivityResourcesRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, ActivitySubEventResourceRecord>) }
      : {};
    const ids = Array.isArray(source?.ids)
      ? source.ids.map(id => `${id}`)
      : Object.keys(byId);
    const idsByOwnerKey = source?.idsByOwnerKey && typeof source.idsByOwnerKey === 'object'
      ? Object.fromEntries(
          Object.entries(source.idsByOwnerKey).map(([ownerKey, recordIds]) => [
            ownerKey,
            Array.isArray(recordIds) ? recordIds.map(id => `${id}`) : []
          ])
        )
      : {};
    for (const id of ids) {
      const record = byId[id];
      const ownerKey = `${record?.ownerKey ?? ''}`.trim();
      if (!ownerKey) {
        continue;
      }
      const bucket = idsByOwnerKey[ownerKey] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      idsByOwnerKey[ownerKey] = bucket;
    }
    return { byId, ids, idsByOwnerKey };
  }

  private cloneRecord(record: ActivitySubEventResourceRecord): ActivitySubEventResourceRecord {
    return {
      ...record,
      assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(record.assetAssignmentIds),
      assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(record.assetSettingsByType),
      supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
        record.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(
        record.fallbackAssetCardsByType
      )
    };
  }

  private syncManualRequestsInAssetsTable(
    table: AssetsRecordCollection,
    resourceRecords: readonly ActivitySubEventResourceRecord[],
    eventsById: ReadonlyMap<string, ActivityEventRecord | undefined>
  ): AssetsRecordCollection {
    const nextById = { ...table.byId };
    let changed = false;
    for (const record of resourceRecords) {
      const event = eventsById.get(record.ownerId);
      const subEvent = event?.subEvents?.find(item => item.id === record.subEventId);
      if (!event || !subEvent) {
        continue;
      }
      for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
        const assignedIds = record.assetAssignmentIds[type] ?? [];
        for (const assetId of assignedIds) {
          const card = nextById[assetId];
          if (!card) {
            continue;
          }
          const existingRequestIndex = card.requests.findIndex(request =>
            ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEvent.id)
          );
          const existingRequest = existingRequestIndex >= 0 ? card.requests[existingRequestIndex] : null;
          const quantity = type === 'Supplies'
            ? (record.supplyContributionEntriesByAssetId[assetId] ?? [])
                .reduce((sum, entry) => sum + entry.quantity, 0)
            : 0;
          if (type === 'Supplies' && quantity <= 0) {
            if (existingRequestIndex >= 0) {
              const nextRequests = [...card.requests];
              nextRequests.splice(existingRequestIndex, 1);
              nextById[assetId] = {
                ...card,
                requests: nextRequests,
                updatedMs: record.updatedMs,
                updatedAtIso: record.updatedAtIso
              };
              changed = true;
            }
            continue;
          }
          const desiredRequest: AppDTOs.AssetMemberRequestDTO = {
            id: existingRequest?.id ?? `manual:${subEvent.id}:${card.id}`,
            userId: record.assetOwnerUserId,
            name: 'Demo User',
            initials: 'DU',
            gender: 'man',
            status: 'accepted',
            note: '',
            requestKind: 'manual',
            requestedAtIso: existingRequest?.requestedAtIso ?? record.createdAtIso,
            booking: {
              eventId: event.id,
              subEventId: subEvent.id,
              startAtIso: subEvent.startAt,
              endAtIso: subEvent.endAt,
              quantity: type === 'Supplies' ? quantity : 1,
              totalAmount: 0,
              currency: 'USD',
              acceptedPolicyIds: [],
              paymentSessionId: '',
              inventoryApplied: true
            }
          };
          if (
            !existingRequest
            || ActivityResourceBuilder.assetRequestSyncSignature(existingRequest)
              !== ActivityResourceBuilder.assetRequestSyncSignature(desiredRequest)
          ) {
            const nextRequests = [...card.requests];
            if (existingRequestIndex >= 0) {
              nextRequests[existingRequestIndex] = desiredRequest;
            } else {
              nextRequests.push(desiredRequest);
            }
            nextById[assetId] = {
              ...card,
              requests: nextRequests,
              updatedMs: record.updatedMs,
              updatedAtIso: record.updatedAtIso
            };
            changed = true;
          }
        }
      }
    }
    return changed ? { ...table, byId: nextById } : table;
  }

  private normalizeAssetsCollection(value: unknown): AssetsRecordCollection {
    const source = value as Partial<AssetsRecordCollection> | null | undefined;
    return {
      byId: source?.byId ? { ...source.byId } : {},
      ids: Array.isArray(source?.ids) ? [...source.ids] : [],
      idsByOwnerUserId: source?.idsByOwnerUserId ? { ...source.idsByOwnerUserId } : {}
    };
  }

  private normalizeRef(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO | null | undefined
  ): AppDTOs.ActivitySubEventResourceStateRefDTO | null {
    const ownerId = `${ref?.ownerId ?? ''}`.trim();
    const subEventId = `${ref?.subEventId ?? ''}`.trim();
    const assetOwnerUserId = `${ref?.assetOwnerUserId ?? ''}`.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return { ownerId, subEventId, assetOwnerUserId };
  }
}
