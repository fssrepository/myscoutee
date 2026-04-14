import { Injectable, inject } from '@angular/core';

import { ActivityResourceBuilder } from '../../base/builders';
import { AppMemoryDb } from '../../base/db';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import { DemoAssetsRepository } from './assets.repository';
import { HttpActivityResourcesRepository } from '../../http/repositories/activity-resources.repository';
import {
  ACTIVITY_RESOURCES_TABLE_NAME,
  type DemoActivityResourcesRecordCollection,
  type DemoActivitySubEventResourceRecord
} from '../models/activity-resources.model';
import { ASSETS_TABLE_NAME, type DemoAssetsRecordCollection } from '../models/assets.model';
import { EVENTS_TABLE_NAME, type DemoEventRecord } from '../models/events.model';
import { DemoEventsRepository } from './events.repository';
import { DemoUsersRepository } from './users.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityResourcesRepository extends HttpActivityResourcesRepository {
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly assetsRepository = inject(DemoAssetsRepository);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly usersRepository = inject(DemoUsersRepository);
  private lastInitToken = '';

  init(ownerUserIds?: readonly string[]): void {
    console.log(Date.now() + "start - activity resources");
    if (!ownerUserIds) {
      this.usersRepository.init();
      console.log(Date.now() + "users init - activity members");
    }

    const normalizedUserIds = Array.from(new Set(
      (ownerUserIds ?? this.usersRepository.queryAvailableDemoUsers().map(user => user.id))
        .map(userId => userId.trim())
    ))
      .filter(userId => userId.length > 0);
    if (normalizedUserIds.length === 0) {
      return;
    }

    console.log(Date.now() + "events init - activity members");
    this.eventsRepository.init();
    console.log(Date.now() + "assets init - activity members");
    this.assetsRepository.init(normalizedUserIds);

    const eventsTable = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const currentTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    const initToken = `${eventsTable.ids.length}:${currentTable.ids.length}:${Object.keys(currentTable.idsByOwnerKey).length}:${normalizedUserIds.join('|')}`;
    if (this.lastInitToken === initToken) {
      return;
    }

    const managedUserIds = new Set(normalizedUserIds);
    const desiredRecords = normalizedUserIds.flatMap(userId => this.buildSeededRecordsForUser(userId));
    const desiredRecordIds = new Set(desiredRecords.map(record => record.id));
    const nextRecords: DemoActivitySubEventResourceRecord[] = [];
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
      this.lastInitToken = initToken;
      return;
    }

    const nextTable = this.buildCollection(nextRecords);
    const assetsTable = this.normalizeAssetsCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const nextAssetsTable = this.syncManualRequestsInAssetsTable(assetsTable, nextRecords);

    console.log(Date.now() + "end - activity members");

    this.memoryDb.write(state => ({
      ...state,
      [ACTIVITY_RESOURCES_TABLE_NAME]: nextTable,
      [ASSETS_TABLE_NAME]: nextAssetsTable
    }));

    console.log(Date.now() + "finish - activity members");

    this.lastInitToken = `${eventsTable.ids.length}:${nextTable.ids.length}:${Object.keys(nextTable.idsByOwnerKey).length}:${normalizedUserIds.join('|')}`;
  }

  override peekSubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    return this.readState(normalizedRef);
  }

  override async querySubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    return this.peekSubEventResourceState(ref);
  }

  override async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return null;
    }
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.memoryDb.write(currentState => {
      const table = this.normalizeCollection(currentState[ACTIVITY_RESOURCES_TABLE_NAME]);
      const recordId = ActivityResourceBuilder.recordId(normalizedState);
      const existing = table.byId[recordId];
      const nextRecord: DemoActivitySubEventResourceRecord = {
        id: recordId,
        ownerKey: ActivityResourceBuilder.ownerKey(normalizedState),
        ownerId: normalizedState.ownerId,
        subEventId: normalizedState.subEventId,
        assetOwnerUserId: normalizedState.assetOwnerUserId,
        assetAssignmentIds: ActivityResourceBuilder.cloneAssetAssignmentIds(normalizedState.assetAssignmentIds),
        assetSettingsByType: ActivityResourceBuilder.cloneAssetSettingsByType(normalizedState.assetSettingsByType),
        supplyContributionEntriesByAssetId: ActivityResourceBuilder.cloneSupplyContributionEntriesByAssetId(
          normalizedState.supplyContributionEntriesByAssetId
        ),
        fallbackAssetCardsByType: ActivityResourceBuilder.cloneFallbackAssetCardsByType(
          normalizedState.fallbackAssetCardsByType
        ),
        createdMs: existing?.createdMs ?? nowMs,
        updatedMs: nowMs,
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso
      };
      return {
        ...currentState,
        [ACTIVITY_RESOURCES_TABLE_NAME]: this.upsertRecordCollection(table, nextRecord)
      };
    });
    return this.readState(normalizedState);
  }

  private readState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_RESOURCES_TABLE_NAME]);
    const record = table.byId[ActivityResourceBuilder.recordId(normalizedRef)];
    if (!record) {
      return null;
    }
    const fallbackCardsByType = ActivityResourceBuilder.cloneFallbackAssetCardsByType(record.fallbackAssetCardsByType);
    const assets = this.assetsRepository.peekOwnedAssetsByUser(normalizedRef.assetOwnerUserId);
    const eligibleIdsByType: Partial<Record<AppTypes.AssetType, Set<string>>> = {
      Car: new Set([
        ...assets.filter(card => card.type === 'Car').map(card => card.id),
        ...(fallbackCardsByType.Car ?? []).map(card => card.id)
      ]),
      Accommodation: new Set([
        ...assets.filter(card => card.type === 'Accommodation').map(card => card.id),
        ...(fallbackCardsByType.Accommodation ?? []).map(card => card.id)
      ]),
      Supplies: new Set([
        ...assets.filter(card => card.type === 'Supplies').map(card => card.id),
        ...(fallbackCardsByType.Supplies ?? []).map(card => card.id)
      ])
    };
    const normalizedState = ActivityResourceBuilder.normalizeState({
      ownerId: record.ownerId,
      subEventId: record.subEventId,
      assetOwnerUserId: record.assetOwnerUserId,
      assetAssignmentIds: {
        Car: (record.assetAssignmentIds.Car ?? []).filter(id => eligibleIdsByType.Car?.has(id)),
        Accommodation: (record.assetAssignmentIds.Accommodation ?? []).filter(id => eligibleIdsByType.Accommodation?.has(id)),
        Supplies: (record.assetAssignmentIds.Supplies ?? []).filter(id => eligibleIdsByType.Supplies?.has(id))
      },
      assetSettingsByType: this.filterSettingsByEligibleIds(record.assetSettingsByType, eligibleIdsByType),
      supplyContributionEntriesByAssetId: Object.fromEntries(
        Object.entries(record.supplyContributionEntriesByAssetId ?? {})
          .filter(([assetId]) => eligibleIdsByType.Supplies?.has(assetId))
      ),
      fallbackAssetCardsByType: {
        Car: (fallbackCardsByType.Car ?? []).filter(card => eligibleIdsByType.Car?.has(card.id)),
        Accommodation: (fallbackCardsByType.Accommodation ?? []).filter(card => eligibleIdsByType.Accommodation?.has(card.id)),
        Supplies: (fallbackCardsByType.Supplies ?? []).filter(card => eligibleIdsByType.Supplies?.has(card.id))
      }
    }, normalizedRef);
    return normalizedState ? ActivityResourceBuilder.cloneState(normalizedState) : null;
  }

  private filterSettingsByEligibleIds(
    source: AppTypes.ActivitySubEventAssetSettingsByType,
    eligibleIdsByType: Partial<Record<AppTypes.AssetType, Set<string>>>
  ): AppTypes.ActivitySubEventAssetSettingsByType {
    const next: AppTypes.ActivitySubEventAssetSettingsByType = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const settings = source?.[type];
      const eligible = eligibleIdsByType[type];
      if (!settings || !eligible) {
        continue;
      }
      const entries = Object.entries(settings).filter(([assetId]) => eligible.has(assetId));
      if (entries.length > 0) {
        next[type] = Object.fromEntries(entries.map(([assetId, value]) => [assetId, { ...value, routes: [...(value.routes ?? [])] }]));
      }
    }
    return next;
  }

  private buildSeededRecordsForUser(userId: string): DemoActivitySubEventResourceRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const assets = this.assetsRepository.peekOwnedAssetsByUser(normalizedUserId);
    const sourceRecords = this.collectSourceRecordsForUser(normalizedUserId);
    const seenRecordIds = new Set<string>();
    const nextRecords: DemoActivitySubEventResourceRecord[] = [];
    let createdMs = Date.now();

    for (const record of sourceRecords) {
      if (!this.shouldSeedResourcesForParticipant(record, normalizedUserId)) {
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
    record: DemoEventRecord,
    userId: string
  ): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    return this.resolveSeededResourceContributorUserIds(record).includes(normalizedUserId);
  }

  private collectSourceRecordsForUser(
    userId: string
  ): DemoEventRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const sourceRecordsByEventId = new Map<string, DemoEventRecord>();

    for (const record of this.eventsRepository.queryItemsByUser(normalizedUserId)) {
      if (!record || !record.id || (record.subEvents?.length ?? 0) === 0) {
        continue;
      }
      if (record.isTrashed || record.isInvitation) {
        continue;
      }
      const current = sourceRecordsByEventId.get(record.id);
      if (!current || this.shouldPreferParticipantSourceRecord(record, current)) {
        sourceRecordsByEventId.set(record.id, record);
      }
    }

    return [...sourceRecordsByEventId.values()];
  }

  private shouldPreferParticipantSourceRecord(next: DemoEventRecord, current: DemoEventRecord): boolean {
    if (next.type === 'hosting' && current.type !== 'hosting') {
      return true;
    }
    if (next.type !== 'hosting' && current.type === 'hosting') {
      return false;
    }
    if (next.isAdmin !== current.isAdmin) {
      return next.isAdmin;
    }
    if (next.published !== current.published) {
      return next.published;
    }
    return next.activity >= current.activity;
  }

  private resolveSeededResourceContributorUserIds(record: DemoEventRecord): string[] {
    const creatorUserId = `${record.creatorUserId ?? ''}`.trim();
    const acceptedMemberUserIds = (record.acceptedMemberUserIds ?? [])
      .map(userId => `${userId}`.trim())
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

  private resolveSeededResourceContributorTarget(record: DemoEventRecord, maxCount: number): number {
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

  private cloneRecord(record: DemoActivitySubEventResourceRecord): DemoActivitySubEventResourceRecord {
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

  private buildCollection(records: readonly DemoActivitySubEventResourceRecord[]): DemoActivityResourcesRecordCollection {
    const byId: Record<string, DemoActivitySubEventResourceRecord> = {};
    const ids: string[] = [];
    const idsByOwnerKey: Record<string, string[]> = {};

    for (const record of records) {
      byId[record.id] = this.cloneRecord(record);
      ids.push(record.id);
      const ownerBucket = idsByOwnerKey[record.ownerKey] ?? [];
      ownerBucket.push(record.id);
      idsByOwnerKey[record.ownerKey] = ownerBucket;
    }

    return {
      byId,
      ids,
      idsByOwnerKey
    };
  }

  private normalizeCollection(value: unknown): DemoActivityResourcesRecordCollection {
    const source = value as Partial<DemoActivityResourcesRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, DemoActivitySubEventResourceRecord>) }
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

    return {
      byId,
      ids,
      idsByOwnerKey
    };
  }

  private upsertRecordCollection(
    table: DemoActivityResourcesRecordCollection,
    record: DemoActivitySubEventResourceRecord
  ): DemoActivityResourcesRecordCollection {
    const byId = {
      ...table.byId,
      [record.id]: record
    };
    const ids = table.ids.includes(record.id)
      ? [...table.ids]
      : [...table.ids, record.id];
    const idsByOwnerKey = {
      ...table.idsByOwnerKey
    };
    const bucket = idsByOwnerKey[record.ownerKey] ?? [];
    if (!bucket.includes(record.id)) {
      idsByOwnerKey[record.ownerKey] = [...bucket, record.id];
    }
    return {
      byId,
      ids,
      idsByOwnerKey
    };
  }
  private syncManualRequestsInAssetsTable(
    table: DemoAssetsRecordCollection,
    resourceRecords: readonly DemoActivitySubEventResourceRecord[]
  ): DemoAssetsRecordCollection {
    const nextById = { ...table.byId };
    let changed = false;

    for (const record of resourceRecords) {
      const state = this.memoryDb.read();
      const eventsTable = state[EVENTS_TABLE_NAME];
      const event = eventsTable.byId[record.ownerId];
      const subEvent = event?.subEvents?.find((item: any) => item.id === record.subEventId);
      if (!subEvent) {
        continue;
      }

      for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
        const assignedIds = record.assetAssignmentIds[type] ?? [];
        for (const assetId of assignedIds) {
          const card = nextById[assetId];
          if (!card) {
            continue;
          }

          const existingRequestIndex = card.requests.findIndex(r =>
            ActivityResourceBuilder.isSubEventManualAssignmentRequest(r, subEvent.id)
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
                updatedMs: Date.now(),
                updatedAtIso: new Date().toISOString()
              };
              changed = true;
            }
            continue;
          }

          const desiredRequest: AppTypes.AssetMemberRequest = {
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

          if (!existingRequest || ActivityResourceBuilder.assetRequestSyncSignature(existingRequest) !== ActivityResourceBuilder.assetRequestSyncSignature(desiredRequest)) {
            const nextRequests = [...card.requests];
            if (existingRequestIndex >= 0) {
              nextRequests[existingRequestIndex] = desiredRequest;
            } else {
              nextRequests.push(desiredRequest);
            }
            nextById[assetId] = {
              ...card,
              requests: nextRequests,
              updatedMs: Date.now(),
              updatedAtIso: new Date().toISOString()
            };
            changed = true;
          }
        }
      }
    }

    return changed ? { ...table, byId: nextById } : table;
  }

  private normalizeAssetsCollection(value: unknown): DemoAssetsRecordCollection {
    const source = value as Partial<DemoAssetsRecordCollection> | null | undefined;
    return {
      byId: source?.byId ? { ...source.byId } : {},
      ids: Array.isArray(source?.ids) ? [...source.ids] : [],
      idsByOwnerUserId: source?.idsByOwnerUserId ? { ...source.idsByOwnerUserId } : {}
    };
  }
}
