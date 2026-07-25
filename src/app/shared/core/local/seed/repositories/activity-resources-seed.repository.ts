import {
  EVENTS_TABLE_NAME,
  type ActivityEventRecordCollection
} from '../../source/entity/event.entity';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../../environments/environment';

import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../../common/app.db';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type ActivityMembersRecordCollection
} from '../../source/entity/activity.entity';
import {
  ACTIVITY_RESOURCES_TABLE_NAME,
  type ActivityResourcesRecordCollection,
  type ActivitySubEventAssetAssignmentIdsRecord,
  type ActivitySubEventAssetSettingsByTypeRecord,
  type ActivitySubEventResourceRecord,
  type ActivitySubEventSupplyContributionsByAssetIdRecord
} from '../../source/entity/activity.entity';
import {
  ASSET_REQUESTS_TABLE_NAME,
  ASSETS_TABLE_NAME,
  type AssetMemberRequestRecord,
  type AssetRequestRecord,
  type AssetRequestsRecordCollection,
  type AssetRecord,
  type AssetSnapshotRecord,
  type AssetsRecordCollection
} from '../../source/entity/asset.entity';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';

import * as AppConstants from '../../../common/constants';

interface SeedActivityResourceRef {
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeedActivityResourcesRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private lastSeedToken = '';

  seedDefaults(
    ownerUserIds?: readonly string[],
    sourceRecordsByUserId?: ReadonlyMap<string, readonly ActivityEventRecord[]>,
    assetsByUserId?: ReadonlyMap<string, readonly AssetRecord[]>
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
    const activityMembersTable = state[ACTIVITY_MEMBERS_TABLE_NAME];
    const currentTable = this.normalizeCollection(state[ACTIVITY_RESOURCES_TABLE_NAME]);
    const currentAssetRequestsTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
    const seedToken = [
      eventsTable.ids.length,
      currentTable.ids.length,
      Object.keys(currentTable.idsByOwnerKey).length,
      currentAssetRequestsTable.ids.length,
      normalizedUserIds.join('|')
    ].join(':');
    if (this.lastSeedToken === seedToken) {
      return;
    }

    const ownedAssetsByUserId = assetsByUserId ?? this.readOwnedAssetsByUsers(
      normalizedUserIds,
      this.normalizeAssetsCollection(state[ASSETS_TABLE_NAME])
    );
    const sourceRecords = this.mergeSourceRecordsByUserId(
      normalizedUserIds,
      sourceRecordsByUserId,
      this.collectSourceRecordsByUserId(normalizedUserIds, eventsTable)
    );
    const acceptedMemberUserIdsByEventId = this.acceptedMemberUserIdsByEventId(activityMembersTable);
    const contributorUserIdsByEventId = new Map<string, string[]>();
    const generatedEventResourceRecords = normalizedUserIds.flatMap(userId =>
      this.buildSeededRecordsForUser(
        userId,
        sourceRecords.get(userId),
        ownedAssetsByUserId.get(userId),
        contributorUserIdsByEventId,
        acceptedMemberUserIdsByEventId
      )
    );
    const manualAssignmentResourceRecords = this.buildAssetRequestResourceRecords(
      normalizedUserIds,
      currentAssetRequestsTable,
      ownedAssetsByUserId
    );
    const assetJoinShowcaseRecords = this.buildAssetJoinShowcaseRecords(sourceRecords, ownedAssetsByUserId);
    const desiredRecords = this.uniqueSeededResourceRecords([
      ...generatedEventResourceRecords,
      ...manualAssignmentResourceRecords,
      ...assetJoinShowcaseRecords
    ]);
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
      currentAssetRequestsTable.ids.length,
      normalizedUserIds.join('|')
    ].join(':');
  }

  private buildSeededRecordsForUser(
    userId: string,
    seedSourceRecords?: readonly ActivityEventRecord[],
    _seedAssets?: readonly AssetRecord[],
    contributorUserIdsByEventId?: Map<string, string[]>,
    acceptedMemberUserIdsByEventId?: ReadonlyMap<string, readonly string[]>
  ): ActivitySubEventResourceRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const sourceRecords = seedSourceRecords ?? [];
    const seenRecordIds = new Set<string>();
    const nextRecords: ActivitySubEventResourceRecord[] = [];
    let createdMs = AppUtils.anchorDate(environment.bootstrapOffsetInDays).getTime();

    for (const record of sourceRecords) {
      if (!this.shouldSeedResourcesForParticipant(
        record,
        normalizedUserId,
        contributorUserIdsByEventId,
        acceptedMemberUserIdsByEventId
      )) {
        continue;
      }
      const subEventIds = this.resourceSeedSubEventIds(record);
      if (!this.isGeneratedSlotRecord(record) || subEventIds.length === 0) {
        continue;
      }
      for (const subEventId of subEventIds) {
        const normalizedRef = this.normalizeRef({
          ownerId: record.id,
          subEventId,
          assetOwnerUserId: normalizedUserId
        });
        if (!normalizedRef) {
          continue;
        }
        const recordId = this.resourceRecordId(normalizedRef);
        if (seenRecordIds.has(recordId)) {
          continue;
        }
        seenRecordIds.add(recordId);
        const createdAtIso = new Date(createdMs).toISOString();
        nextRecords.push({
          id: recordId,
          ownerKey: this.resourceOwnerKey(normalizedRef),
          ownerId: normalizedRef.ownerId,
          subEventId: normalizedRef.subEventId,
          assetOwnerUserId: normalizedRef.assetOwnerUserId,
          assetAssignmentIds: {},
          assetSettingsByType: {},
          supplyContributionEntriesByAssetId: {},
          fallbackAssetCardsByType: {},
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

  private buildAssetJoinShowcaseRecords(
    sourceRecordsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>,
    assetsByUserId: ReadonlyMap<string, readonly AssetRecord[]>
  ): ActivitySubEventResourceRecord[] {
    const event = (sourceRecordsByUserId.get('u3') ?? [])
      .find(record => record.id === 'asset-join-demo-nagy-eszter');
    const activeUserId = 'u3';
    const assetManagerUserId = 'u4';
    const asset = (assetsByUserId.get(assetManagerUserId) ?? [])
      .find(record => record.id === `${assetManagerUserId}:asset-transport-3`);
    const subEventId = 'asset-join-demo-nagy-eszter-transport-pickup';
    if (!event || !asset || !this.resourceSeedSubEventIds(event).includes(subEventId)) {
      return [];
    }

    const ref = this.normalizeRef({
      ownerId: event.id,
      subEventId,
      assetOwnerUserId: activeUserId
    });
    if (!ref) {
      return [];
    }

    const createdMs = AppUtils.anchorDate(environment.bootstrapOffsetInDays).getTime() + 50_000;
    const createdAtIso = new Date(createdMs).toISOString();
    return [{
      id: this.resourceRecordId(ref),
      status: 'A',
      ownerKey: this.resourceOwnerKey(ref),
      ownerId: ref.ownerId,
      subEventId: ref.subEventId,
      assetOwnerUserId: ref.assetOwnerUserId,
      assetAssignmentIds: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: [asset.id]
      },
      assetSettingsByType: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: {
          [asset.id]: {
            capacityMin: 0,
            capacityMax: Math.max(1, Math.trunc(Number(asset.capacityTotal) || 1)),
            quantity: 1,
            addedByUserId: assetManagerUserId,
            routeEnabled: (asset.routes ?? []).length > 0,
            routes: this.normalizeRoutes(asset.routes)
          }
        }
      },
      supplyContributionEntriesByAssetId: {},
      fallbackAssetCardsByType: this.cloneFallbackAssetCardsByType({
        [AppConstants.ASSET_TYPE_TRANSPORT]: [asset]
      }),
      createdMs,
      updatedMs: createdMs,
      createdAtIso,
      updatedAtIso: createdAtIso
    }];
  }

  private shouldSeedResourcesForParticipant(
    record: ActivityEventRecord,
    userId: string,
    contributorUserIdsByEventId?: Map<string, string[]>,
    acceptedMemberUserIdsByEventId?: ReadonlyMap<string, readonly string[]>
  ): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    let contributorUserIds = contributorUserIdsByEventId?.get(record.id);
    if (!contributorUserIds) {
      contributorUserIds = this.resolveSeededResourceContributorUserIds(
        record,
        acceptedMemberUserIdsByEventId?.get(record.id) ?? []
      );
      contributorUserIdsByEventId?.set(record.id, contributorUserIds);
    }
    return contributorUserIds.includes(normalizedUserId);
  }

  private resolveSeededResourceContributorUserIds(
    record: ActivityEventRecord,
    acceptedMemberUserIds: readonly string[]
  ): string[] {
    const creatorUserId = `${record.creatorUserId ?? ''}`.trim();
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

  private collectSourceRecordsByUserId(
    userIds: readonly string[],
    eventsTable: ActivityEventRecordCollection
  ): Map<string, ActivityEventRecord[]> {
    const recordsByUserId = new Map<string, ActivityEventRecord[]>();
    for (const userId of userIds) {
      const sourceRecordsByEventId = new Map<string, ActivityEventRecord>();
      for (const id of eventsTable.ids) {
        const record = eventsTable.byId[id];
        if (
          !record
          || !record.id
          || !this.isGeneratedSlotRecord(record)
          || this.resourceSeedSubEventIds(record).length === 0
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

  private mergeSourceRecordsByUserId(
    userIds: readonly string[],
    sourceRecordsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]> | undefined,
    generatedSlotRecordsByUserId: ReadonlyMap<string, readonly ActivityEventRecord[]>
  ): Map<string, ActivityEventRecord[]> {
    const result = new Map<string, ActivityEventRecord[]>();
    for (const userId of userIds) {
      const byId = new Map<string, ActivityEventRecord>();
      for (const record of sourceRecordsByUserId?.get(userId) ?? []) {
        if (this.isGeneratedSlotRecord(record) && this.resourceSeedSubEventIds(record).length > 0) {
          byId.set(record.id, record);
        }
      }
      for (const record of generatedSlotRecordsByUserId.get(userId) ?? []) {
        byId.set(record.id, record);
      }
      result.set(userId, [...byId.values()]);
    }
    return result;
  }

  private resourceSeedSubEventIds(record: ActivityEventRecord | null | undefined): string[] {
    return (record?.subEventDefinitions ?? [])
      .map((item, index) => `${item?.id ?? ''}`.trim() || `subevent-${index + 1}`)
      .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index);
  }

  private isGeneratedSlotRecord(record: ActivityEventRecord | null | undefined): boolean {
    return Boolean(record?.generated) || record?.eventType === 'slot' || Boolean(record?.parentEventId);
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

  private readOwnedAssetsByUsers(
    userIds: readonly string[],
    table: AssetsRecordCollection
  ): Map<string, AssetRecord[]> {
    const assetsByUserId = new Map<string, AssetRecord[]>();
    for (const userId of userIds) {
      assetsByUserId.set(
        userId,
        (table.idsByOwnerUserId[userId] ?? [])
          .map(id => table.byId[id])
          .filter((record): record is AssetRecord => Boolean(record))
      );
    }
    return assetsByUserId;
  }

  private acceptedMemberUserIdsByEventId(
    table: ActivityMembersRecordCollection
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const [ownerKey, memberIds] of Object.entries(table.idsByOwnerKey)) {
      if (!ownerKey.startsWith('event:')) {
        continue;
      }
      const eventId = ownerKey.slice('event:'.length).trim();
      if (!eventId) {
        continue;
      }
      result.set(eventId, Array.from(new Set(memberIds
        .map(memberId => table.byId[memberId])
        .filter(member => member?.status === 'accepted')
        .map(member => `${member?.userId ?? ''}`.trim())
        .filter(Boolean))));
    }
    return result;
  }

  private buildAssetRequestResourceRecords(
    ownerUserIds: readonly string[],
    requestsTable: AssetRequestsRecordCollection,
    assetsByUserId: ReadonlyMap<string, readonly AssetRecord[]>
  ): ActivitySubEventResourceRecord[] {
    const managedUserIds = new Set(ownerUserIds.map(userId => `${userId ?? ''}`.trim()).filter(Boolean));
    const assetById = new Map<string, AssetRecord>();
    for (const [userId, assets] of assetsByUserId.entries()) {
      if (!managedUserIds.has(`${userId ?? ''}`.trim())) {
        continue;
      }
      for (const asset of assets ?? []) {
        const assetId = `${asset?.id ?? ''}`.trim();
        if (assetId) {
          assetById.set(assetId, asset);
        }
      }
    }

    const recordsById = new Map<string, ActivitySubEventResourceRecord>();
    for (const requestId of requestsTable.ids) {
      const request = requestsTable.byId[requestId];
      if (!this.isAcceptedManualBookedRequest(request)) {
        continue;
      }
      const ownerUserId = `${request.ownerUserId ?? ''}`.trim();
      if (!managedUserIds.has(ownerUserId)) {
        continue;
      }
      const asset = assetById.get(`${request.assetId ?? ''}`.trim());
      if (!asset || `${asset.ownerUserId ?? ''}`.trim() !== ownerUserId) {
        continue;
      }
      const normalizedRef = this.normalizeRef({
        ownerId: `${request.booking?.eventId ?? ''}`.trim(),
        subEventId: `${request.booking?.subEventId ?? ''}`.trim(),
        assetOwnerUserId: ownerUserId
      });
      if (!normalizedRef) {
        continue;
      }
      const recordId = this.resourceRecordId(normalizedRef);
      const record = recordsById.get(recordId) ?? this.createAssetRequestResourceRecord(normalizedRef, request);
      this.applyAssetRequestAssignment(record, asset, request);
      recordsById.set(recordId, record);
    }

    return [...recordsById.values()];
  }

  private uniqueSeededResourceRecords(
    records: readonly ActivitySubEventResourceRecord[]
  ): ActivitySubEventResourceRecord[] {
    const byId = new Map<string, ActivitySubEventResourceRecord>();
    for (const record of records) {
      byId.set(record.id, this.cloneRecord(record));
    }
    return [...byId.values()];
  }

  private createAssetRequestResourceRecord(
    ref: SeedActivityResourceRef,
    request: AssetRequestRecord
  ): ActivitySubEventResourceRecord {
    const createdMs = this.assetRequestSeedMs(request);
    const createdAtIso = request.createdAtIso || new Date(createdMs).toISOString();
    return {
      id: this.resourceRecordId(ref),
      status: 'A',
      ownerKey: this.resourceOwnerKey(ref),
      ownerId: ref.ownerId,
      subEventId: ref.subEventId,
      assetOwnerUserId: ref.assetOwnerUserId,
      assetAssignmentIds: {},
      assetSettingsByType: {},
      supplyContributionEntriesByAssetId: {},
      fallbackAssetCardsByType: {},
      createdMs,
      updatedMs: createdMs,
      createdAtIso,
      updatedAtIso: createdAtIso
    };
  }

  private applyAssetRequestAssignment(
    record: ActivitySubEventResourceRecord,
    asset: AssetRecord,
    request: AssetRequestRecord
  ): void {
    const type = asset.type;
    const assetId = asset.id.trim();
    if (!assetId) {
      return;
    }

    const assignedIds = record.assetAssignmentIds[type] ?? [];
    if (!assignedIds.includes(assetId)) {
      record.assetAssignmentIds[type] = [...assignedIds, assetId];
    }

    const routes = this.normalizeRoutes(asset.routes);
    const settingsByAssetId = record.assetSettingsByType[type] ?? {};
    record.assetSettingsByType[type] = {
      ...settingsByAssetId,
      [assetId]: {
        capacityMin: 0,
        capacityMax: this.assetRequestAssignmentCapacity(asset, request),
        quantity: this.assetRequestQuantity(request),
        addedByUserId: record.assetOwnerUserId,
        routeEnabled: routes.length > 0,
        routes
      }
    };

    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
      const quantity = this.assetRequestQuantity(request);
      const entryId = `${request.id}:seed-supply`;
      const existingEntries = record.supplyContributionEntriesByAssetId[assetId] ?? [];
      if (!existingEntries.some(entry => entry.id === entryId)) {
        record.supplyContributionEntriesByAssetId[assetId] = [
          ...existingEntries,
          {
            id: entryId,
            userId: record.assetOwnerUserId,
            quantity,
            addedAtIso: request.createdAtIso || record.createdAtIso
          }
        ];
      }
    }

    const updatedMs = this.assetRequestUpdatedMs(request);
    if (updatedMs >= record.updatedMs) {
      record.updatedMs = updatedMs;
      record.updatedAtIso = request.updatedAtIso || new Date(updatedMs).toISOString();
    }
  }

  private isAcceptedManualBookedRequest(
    request: AssetRequestRecord | null | undefined
  ): request is AssetRequestRecord {
    return Boolean(
      request
      && request.requestKind === 'manual'
      && request.status === 'accepted'
      && `${request.assetId ?? ''}`.trim()
      && `${request.ownerUserId ?? ''}`.trim()
      && `${request.booking?.eventId ?? ''}`.trim()
      && `${request.booking?.subEventId ?? ''}`.trim()
    );
  }

  private assetRequestAssignmentCapacity(asset: AssetRecord, request: AssetRequestRecord): number {
    if (asset.type === AppConstants.ASSET_TYPE_SUPPLIES) {
      return this.assetRequestQuantity(request);
    }
    const capacity = Math.trunc(Number(asset.capacityTotal));
    if (Number.isFinite(capacity) && capacity > 0) {
      return capacity;
    }
    return 1;
  }

  private assetRequestQuantity(request: AssetRequestRecord): number {
    const quantity = Math.trunc(Number(request.booking?.quantity));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  }

  private assignmentRecordQuantity(
    settings: { quantity?: unknown } | null | undefined
  ): number {
    const quantity = Math.trunc(Number(settings?.quantity));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  }

  private assetRequestSeedMs(request: AssetRequestRecord): number {
    const createdMs = Math.trunc(Number(request.createdMs));
    if (Number.isFinite(createdMs) && createdMs > 0) {
      return createdMs;
    }
    const sortableCreatedAt = AppUtils.toSortableDate(request.createdAtIso);
    return sortableCreatedAt > 0 ? sortableCreatedAt : Date.now();
  }

  private assetRequestUpdatedMs(request: AssetRequestRecord): number {
    const updatedMs = Math.trunc(Number(request.updatedMs));
    if (Number.isFinite(updatedMs) && updatedMs > 0) {
      return updatedMs;
    }
    const sortableUpdatedAt = AppUtils.toSortableDate(request.updatedAtIso);
    return sortableUpdatedAt > 0 ? sortableUpdatedAt : this.assetRequestSeedMs(request);
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

  private normalizeAssetRequestsCollection(value: unknown): AssetRequestsRecordCollection {
    const source = value as Partial<AssetRequestsRecordCollection> | null | undefined;
    return {
      byId: source?.byId && typeof source.byId === 'object'
        ? { ...(source.byId as Record<string, AssetRequestRecord>) }
        : {},
      ids: Array.isArray(source?.ids)
        ? source.ids.map(id => `${id}`).filter(Boolean)
        : [],
      idsByOwnerKey: source?.idsByOwnerKey && typeof source.idsByOwnerKey === 'object'
        ? Object.fromEntries(
            Object.entries(source.idsByOwnerKey).map(([ownerKey, requestIds]) => [
              `${ownerKey ?? ''}`.trim(),
              Array.isArray(requestIds) ? requestIds.map(id => `${id}`).filter(Boolean) : []
            ]).filter(([ownerKey]) => ownerKey.length > 0)
          )
        : {}
    };
  }

  private cloneRecord(record: ActivitySubEventResourceRecord): ActivitySubEventResourceRecord {
    return {
      ...record,
      assetAssignmentIds: this.cloneAssetAssignmentIds(record.assetAssignmentIds),
      assetSettingsByType: this.cloneAssetSettingsByType(record.assetSettingsByType),
      supplyContributionEntriesByAssetId: this.cloneSupplyContributionEntriesByAssetId(
        record.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: this.cloneFallbackAssetCardsByType(
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
    const events = Array.from(eventsById.values())
      .filter((event): event is ActivityEventRecord => Boolean(event?.id));
    let changed = false;
    for (const record of resourceRecords) {
      const event = eventsById.get(record.ownerId)
        ?? events.find(candidate => record.ownerId.startsWith(`${candidate.id}:`));
      const subEventId = this.resourceSeedSubEventIds(event).find(item => item === record.subEventId) ?? '';
      if (!event || !subEventId) {
        continue;
      }
      for (const type of AppConstants.ASSET_TYPES) {
        const assignedIds = record.assetAssignmentIds[type] ?? [];
        for (const assetId of assignedIds) {
          const card = nextById[assetId];
          if (!card) {
            continue;
          }
          const existingRequestIndex = card.requests.findIndex(request => (
            request.requestKind === 'manual'
            && `${request.booking?.eventId ?? ''}`.trim() === record.ownerId
            && `${request.booking?.subEventId ?? ''}`.trim() === subEventId
          ));
          const existingRequest = existingRequestIndex >= 0 ? card.requests[existingRequestIndex] : null;
          const settings = record.assetSettingsByType[type]?.[assetId] ?? null;
          const quantity = type === AppConstants.ASSET_TYPE_SUPPLIES
            ? (record.supplyContributionEntriesByAssetId[assetId] ?? [])
                .reduce((sum, entry) => sum + entry.quantity, 0)
              || this.assignmentRecordQuantity(settings)
            : this.assignmentRecordQuantity(settings);
          if (type === AppConstants.ASSET_TYPE_SUPPLIES && quantity <= 0) {
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
          const desiredRequest: AssetMemberRequestRecord = {
            id: existingRequest?.id ?? `manual:${record.ownerId}:${subEventId}:${card.id}`,
            userId: record.assetOwnerUserId,
            name: 'Demo User',
            initials: 'DU',
            gender: 'man',
            status: 'accepted',
            note: '',
            requestKind: 'manual',
            requestedAtIso: existingRequest?.requestedAtIso ?? record.createdAtIso,
            booking: {
              eventId: record.ownerId,
              subEventId,
              startAtIso: event.startAtIso,
              endAtIso: event.endAtIso,
              quantity,
              totalAmount: 0,
              currency: 'USD',
              acceptedPolicyIds: [],
              paymentSessionId: '',
              inventoryApplied: true
            }
          };
          if (
            !existingRequest
            || this.assetRequestSyncSignature(existingRequest) !== this.assetRequestSyncSignature(desiredRequest)
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
    ref: SeedActivityResourceRef | null | undefined
  ): SeedActivityResourceRef | null {
    const ownerId = `${ref?.ownerId ?? ''}`.trim();
    const subEventId = `${ref?.subEventId ?? ''}`.trim();
    const assetOwnerUserId = `${ref?.assetOwnerUserId ?? ''}`.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return { ownerId, subEventId, assetOwnerUserId };
  }

  private resourceOwnerKey(ref: SeedActivityResourceRef): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}`;
  }

  private resourceRecordId(ref: SeedActivityResourceRef): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}:${ref.subEventId}`;
  }

  private cloneAssetAssignmentIds(
    source: ActivitySubEventAssetAssignmentIdsRecord | null | undefined
  ): ActivitySubEventAssetAssignmentIdsRecord {
    const next: ActivitySubEventAssetAssignmentIdsRecord = {};
    for (const type of this.assetTypes()) {
      const ids = Array.isArray(source?.[type]) ? source?.[type] : [];
      const normalizedIds = Array.from(new Set(ids
        .map(id => `${id ?? ''}`.trim())
        .filter(id => id.length > 0)));
      if (normalizedIds.length > 0) {
        next[type] = normalizedIds;
      }
    }
    return next;
  }

  private cloneAssetSettingsByType(
    source: ActivitySubEventAssetSettingsByTypeRecord | null | undefined
  ): ActivitySubEventAssetSettingsByTypeRecord {
    const next: ActivitySubEventAssetSettingsByTypeRecord = {};
    for (const type of this.assetTypes()) {
      const rawMap = source?.[type];
      if (!rawMap || typeof rawMap !== 'object') {
        continue;
      }
      const normalizedMap: NonNullable<ActivitySubEventAssetSettingsByTypeRecord[typeof type]> = {};
      for (const [assetId, settings] of Object.entries(rawMap)) {
        const normalizedAssetId = `${assetId ?? ''}`.trim();
        if (!normalizedAssetId || !settings) {
          continue;
        }
        const routes = this.normalizeRoutes(settings.routes);
        normalizedMap[normalizedAssetId] = {
          capacityMin: Math.max(0, Math.trunc(Number(settings.capacityMin) || 0)),
          capacityMax: Math.max(0, Math.trunc(Number(settings.capacityMax) || 0)),
          quantity: this.assignmentRecordQuantity(settings),
          addedByUserId: `${settings.addedByUserId ?? ''}`.trim(),
          routeEnabled: settings.routeEnabled === true && routes.length > 0,
          routes
        };
      }
      if (Object.keys(normalizedMap).length > 0) {
        next[type] = normalizedMap;
      }
    }
    return next;
  }

  private cloneSupplyContributionEntriesByAssetId(
    source: ActivitySubEventSupplyContributionsByAssetIdRecord | null | undefined
  ): ActivitySubEventSupplyContributionsByAssetIdRecord {
    const next: ActivitySubEventSupplyContributionsByAssetIdRecord = {};
    if (!source || typeof source !== 'object') {
      return next;
    }
    for (const [assetId, rawEntries] of Object.entries(source)) {
      const normalizedAssetId = `${assetId ?? ''}`.trim();
      if (!normalizedAssetId || !Array.isArray(rawEntries)) {
        continue;
      }
      const entries = rawEntries
        .map(entry => ({
          id: `${entry?.id ?? ''}`.trim(),
          userId: `${entry?.userId ?? ''}`.trim(),
          quantity: Math.max(0, Math.trunc(Number(entry?.quantity) || 0)),
          addedAtIso: `${entry?.addedAtIso ?? ''}`.trim()
        }))
        .filter(entry => entry.id.length > 0 && entry.userId.length > 0 && entry.quantity > 0)
        .sort((left, right) => AppUtils.toSortableDate(left.addedAtIso) - AppUtils.toSortableDate(right.addedAtIso));
      if (entries.length > 0) {
        next[normalizedAssetId] = entries;
      }
    }
    return next;
  }

  private cloneFallbackAssetCardsByType(
    source: Partial<Record<AppConstants.AssetType, AssetSnapshotRecord[]>> | null | undefined
  ): Partial<Record<AppConstants.AssetType, AssetSnapshotRecord[]>> {
    const next: Partial<Record<AppConstants.AssetType, AssetSnapshotRecord[]>> = {};
    for (const type of this.assetTypes()) {
      const cards = source?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards.map(card => ({
        ...card,
        requests: (card.requests ?? []).map(request => ({
          ...request,
          booking: request.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null,
          menuActions: [...(request.menuActions ?? [])]
        })),
        menuActions: [...(card.menuActions ?? [])]
      }));
    }
    return next;
  }

  private isSubEventManualAssignmentRequest(request: AssetMemberRequestRecord, subEventId: string): boolean {
    const normalizedSubEventId = subEventId.trim();
    return request.requestKind === 'manual'
      && normalizedSubEventId.length > 0
      && request.id.startsWith(`manual:${normalizedSubEventId}:`);
  }

  private assetRequestSyncSignature(request: AssetMemberRequestRecord): string {
    return JSON.stringify({
      id: request.id,
      userId: request.userId ?? '',
      status: request.status,
      requestKind: request.requestKind ?? '',
      bookingQuantity: request.booking?.quantity ?? '',
      bookingAcceptedPolicyIds: [...(request.booking?.acceptedPolicyIds ?? [])]
    });
  }

  private normalizeRoutes(routes: readonly string[] | undefined | null): string[] {
    return Array.from(new Set((routes ?? [])
      .map(route => `${route ?? ''}`.trim())
      .filter(route => route.length > 0)));
  }

  private assetTypes(): readonly AppConstants.AssetType[] {
    return AppConstants.ASSET_TYPES;
  }
}
