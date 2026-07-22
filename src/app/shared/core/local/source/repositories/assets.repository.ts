import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { AssetCardBuilder, PricingBuilder } from '../../../base/builders';
import { UserProfileState } from '../../../common/user-profile-state';
import type { UserDto } from '../../../contracts/user.interface';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalAssetsMapper } from '../mappers/asset.mapper';
import { LocalUsersRepository } from './users.repository';
import {
  ASSET_REQUESTS_TABLE_NAME,
  ASSETS_TABLE_NAME,
  type AssetMemberRequestRecord,
  type AssetRequestRecord,
  type AssetRequestsRecordCollection,
  type AssetRecord,
  type AssetsRecordCollection
} from '../entity/asset.entity';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type ActivityMemberRecord,
  type ActivityMembersRecordCollection
} from '../entity/activity.entity';

import type * as AppDTOs from '../../../contracts';
import type * as AppConstants from '../../../common/constants';

interface AssetExploreRecordProjection {
  record: AssetRecord;
  availability: number;
  price: number;
  policyCount: number;
}

export interface AssetExploreRecordPageResult {
  items: AssetRecord[];
  total: number;
  nextCursor?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LocalAssetsRepository {
  private static readonly VISIBLE_EXPLORE_OWNER_LIMIT = 12;
  private static readonly AFFINITY_DISTANCE_BOOST_SCALE = 10_000;
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly usersRepository = inject(LocalUsersRepository);

  peekOwnedAssetsByUser(userId: string): AppDTOs.AssetDTO[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readOwnerAssets(normalizedUserId);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppDTOs.AssetDTO | null {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return null;
    }
    return this.peekOwnedAssetsByUser(userId).find(card => card.id === normalizedAssetId) ?? null;
  }

  peekOwnedAssetsByUsers(userIds: readonly string[]): Map<string, AppDTOs.AssetDTO[]> {
    const normalizedUserIds = [...new Set(
      userIds
        .map(userId => userId.trim())
        .filter(Boolean)
    )];
    const assetsByUserId = new Map<string, AppDTOs.AssetDTO[]>(
      normalizedUserIds.map(userId => [userId, []])
    );
    if (normalizedUserIds.length === 0) {
      return assetsByUserId;
    }
    const state = this.memoryDb.read();
    const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
    const requestTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
    for (const userId of normalizedUserIds) {
      const records = (table.idsByOwnerUserId[userId] ?? [])
        .map(id => table.byId[id])
        .filter((record): record is AssetRecord => Boolean(record))
        .filter(record => !this.isSuppressedAssetStatus(record.status))
        .sort((left, right) => right.updatedMs - left.updatedMs);
      const metricsByAssetId = this.assetRequestMetricsByAssetId(requestTable, records);
      const assets = records.map(record => this.toAssetDto(record, userId, metricsByAssetId.get(record.id)));
      assetsByUserId.set(userId, assets);
    }
    return assetsByUserId;
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readOwnerAssets(normalizedUserId);
  }

  async loadOwnedAssetDetailById(userId: string, assetId: string): Promise<AppDTOs.AssetDetailDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    const state = this.memoryDb.read();
    const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
    const requestTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
    const record = table.byId[normalizedAssetId];
    return record && record.ownerUserId === normalizedUserId && !this.isSuppressedAssetStatus(record.status)
      ? this.toAssetDetailDto(
          record,
          normalizedUserId,
          this.assetRequestMetricsByAssetId(requestTable, [record]).get(record.id)
        )
      : null;
  }

  async queryVisibleAssets(query: AppDTOs.AssetExploreQueryDTO): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedCategory = `${query.category ?? ''}`.trim();
    return this.readVisibleAssets(normalizedUserId)
      .filter(card => card.type === query.type)
      .filter(card => !normalizedCategory || card.category === normalizedCategory);
  }

  queryVisibleAssetRecordsPage(query: AppDTOs.AssetExplorePageQueryDTO): AssetExploreRecordPageResult {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return {
        items: [],
        total: 0,
        nextCursor: null
      };
    }
    const normalizedCategory = `${query.category ?? ''}`.trim();
    const normalizedOrder = this.normalizeAssetExploreOrder(query.order);
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 10));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const startAtIso = `${query.startAtIso ?? ''}`.trim();
    const endAtIso = `${query.endAtIso ?? ''}`.trim();

    const records = this.readVisibleAssetRecords(normalizedUserId)
      .filter(record => record.type === query.type)
      .filter(record => !normalizedCategory || record.category === normalizedCategory)
      .map(record => this.toAssetExploreProjection(record, startAtIso, endAtIso))
      .filter(item => item.availability > 0)
      .sort((left, right) => this.compareAssetExploreProjections(left, right, normalizedOrder));
    const total = records.length;
    const cursorOffset = this.parseAssetExploreCursor(query.cursor);
    const startIndex = Math.min(total, cursorOffset ?? (page * pageSize));
    const endIndex = Math.min(total, startIndex + pageSize);
    const items = records
      .slice(startIndex, endIndex)
      .map(item => LocalAssetsMapper.cloneRecord(item.record));

    return {
      items,
      total,
      nextCursor: endIndex < total ? `${endIndex}` : null
    };
  }

  queryVisibleAssetsPage(query: AppDTOs.AssetExplorePageQueryDTO): AppDTOs.AssetExplorePageResultDTO {
    const normalizedUserId = query.userId.trim();
    const result = this.queryVisibleAssetRecordsPage(query);
    if (!normalizedUserId || result.items.length === 0) {
      return {
        items: [],
        total: result.total,
        nextCursor: result.nextCursor ?? null
      };
    }
    const requestTable = this.normalizeAssetRequestsCollection(this.memoryDb.read()[ASSET_REQUESTS_TABLE_NAME]);
    const metricsByAssetId = this.assetRequestMetricsByAssetId(requestTable, result.items);
    return {
      items: result.items.map(record => this.toAssetDto(record, normalizedUserId, metricsByAssetId.get(record.id))),
      total: result.total,
      nextCursor: result.nextCursor ?? null
    };
  }

  peekVisibleAssetById(userId: string, type: AppConstants.AssetType, assetId: string): AppDTOs.AssetDTO | null {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    return this.readVisibleAssets(normalizedUserId)
      .find(card => card.type === type && card.id === normalizedAssetId) ?? null;
  }

  async saveOwnedAsset(userId: string, asset: AppDTOs.AssetDetailDTO): Promise<AppDTOs.AssetDTO> {
    const normalizedUserId = userId.trim();
    const normalizedDetail = LocalAssetsMapper.normalizeDetail(asset);
    const incomingRecord = normalizedDetail
      ? LocalAssetsMapper.toAssetRecord(normalizedDetail, normalizedUserId)
      : null;
    if (!normalizedUserId || !normalizedDetail || !incomingRecord) {
      return LocalAssetsMapper.fallbackAssetDto(asset);
    }
    const now = new Date();
    const nowMs = now.getTime();
    let saved: AssetRecord | null = null;

    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      const requestTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
      const existing = table.byId[incomingRecord.id];
      const nextRecord = this.withResolvedAssetRelevance(this.mergeAssetRecord(existing, incomingRecord, nowMs, 'detail'));
      saved = nextRecord;
      return {
        ...state,
        [ASSETS_TABLE_NAME]: this.upsertRecordCollection(table, nextRecord),
        [ASSET_REQUESTS_TABLE_NAME]: this.synchronizeAssetRequestCollection(
          requestTable,
          nextRecord,
          existing?.requests ?? []
        )
      };
    });

    const savedRecord = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]).byId[incomingRecord.id] ?? saved;
    if (!savedRecord) {
      return LocalAssetsMapper.normalizeCard(normalizedDetail)!;
    }
    const requestTable = this.normalizeAssetRequestsCollection(this.memoryDb.read()[ASSET_REQUESTS_TABLE_NAME]);
    return this.toAssetDto(
      savedRecord,
      normalizedUserId,
      this.assetRequestMetricsByAssetId(requestTable, [savedRecord]).get(savedRecord.id)
    );
  }

  async replaceOwnedAssets(
    userId: string,
    assets: readonly AppDTOs.AssetDTO[]
  ): Promise<AppDTOs.AssetDTO[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedAssets = LocalAssetsMapper.normalizeCards(assets);
    const currentTable = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const ownerIds = [...(currentTable.idsByOwnerUserId[normalizedUserId] ?? [])];
    const seenIds = new Set<string>();
    const nextRecords: AssetRecord[] = [];
    let timestampMs = Date.now();

    for (const asset of normalizedAssets) {
      const existing = currentTable.byId[asset.id];
      const incomingRecord = LocalAssetsMapper.toAssetRecord(asset, normalizedUserId);
      if (!incomingRecord) {
        continue;
      }
      const nowMs = timestampMs;
      timestampMs += 1;
      nextRecords.push(this.withResolvedAssetRelevance(this.mergeAssetRecord(existing, incomingRecord, nowMs, 'summary')));
      seenIds.add(asset.id);
    }

    this.memoryDb.write(state => {
      let nextTable = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      let nextRequestTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
      for (const assetId of ownerIds) {
        if (seenIds.has(assetId)) {
          continue;
        }
        nextTable = this.deleteRecordCollection(nextTable, assetId);
        nextRequestTable = this.deleteAssetRequestCollection(nextRequestTable, assetId);
      }
      for (const record of nextRecords) {
        const previousRequests = nextTable.byId[record.id]?.requests ?? [];
        nextTable = this.upsertRecordCollection(nextTable, record);
        nextRequestTable = this.synchronizeAssetRequestCollection(nextRequestTable, record, previousRequests);
      }
      return {
        ...state,
        [ASSETS_TABLE_NAME]: nextTable,
        [ASSET_REQUESTS_TABLE_NAME]: nextRequestTable
      };
    });

    return nextRecords.map(record => this.toAssetDto(record, normalizedUserId));
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return;
    }
    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      const requestTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
      const current = table.byId[normalizedAssetId];
      if (!current || current.ownerUserId !== normalizedUserId) {
        return state;
      }
      return {
        ...state,
        [ASSETS_TABLE_NAME]: this.deleteRecordCollection(table, normalizedAssetId),
        [ASSET_REQUESTS_TABLE_NAME]: this.deleteAssetRequestCollection(requestTable, normalizedAssetId)
      };
    });
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppDTOs.AssetDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    let saved: AssetRecord | null = null;
    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      const current = table.byId[normalizedAssetId];
      if (!current || LocalAssetsMapper.normalizeAssetStatus(current.status) !== 'UR' || !this.canTakeOverAsset(current, normalizedUserId)) {
        return state;
      }
      const actor = this.queryUsers().find(user => user.id === normalizedUserId) ?? null;
      saved = this.withResolvedAssetRelevance({
        ...current,
        ownerUserId: normalizedUserId,
        ownerName: actor?.name ?? current.ownerName,
        status: LocalAssetsMapper.restoredAssetStatus(current),
        statusBeforeSuppression: null,
        updatedMs: Date.now(),
        updatedAtIso: new Date().toISOString()
      });
      return {
        ...state,
        [ASSETS_TABLE_NAME]: this.upsertRecordCollection(table, saved)
      };
    });
    return saved ? this.toAssetDto(saved, normalizedUserId) : null;
  }

  async makeAssetManager(
    userId: string,
    assetId: string,
    targetUserId: string
  ): Promise<AppDTOs.AssetDTO | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedUserId || !normalizedAssetId || !normalizedTargetUserId) {
      return null;
    }

    let saved: AssetRecord | null = null;
    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      const current = table.byId[normalizedAssetId];
      if (!current
        || current.ownerUserId === normalizedTargetUserId
        || !this.canManageAssetMembers(current, normalizedUserId)
        || !this.isActiveDemoUser(normalizedTargetUserId)
        || this.isAcceptedAssetManager(normalizedAssetId, normalizedTargetUserId)) {
        return state;
      }
      const now = new Date();
      const nextRequests = this.promotedAssetRequests(current, normalizedTargetUserId);
      saved = this.withResolvedAssetRelevance({
        ...current,
        requests: nextRequests,
        updatedMs: now.getTime(),
        updatedAtIso: now.toISOString()
      });
      return {
        ...this.upsertDemoAssetManagerRecord(state, saved, normalizedUserId, normalizedTargetUserId, now),
        [ASSETS_TABLE_NAME]: this.upsertRecordCollection(table, saved)
      };
    });
    return saved ? this.toAssetDto(saved, normalizedUserId) : null;
  }

  async revokeAssetManager(userId: string, assetId: string, targetUserId: string): Promise<AppDTOs.AssetDTO | null> {
    const current = this.peekOwnedAssetsByUser(userId).find(asset => asset.id === assetId) ?? null;
    if (!current || !targetUserId.trim()) {
      return null;
    }
    return {
      ...current,
      requests: current.requests.map(request => request.userId === targetUserId
        ? { ...request, note: 'Borrow request approved by the owner.', menuActions: ['makeManager'] }
        : request)
    };
  }

  private queryUsers(): UserDto[] {
    return this.usersRepository.queryGameStackUsers() as UserDto[];
  }

  private assetMemberRecords(assetId: string): ActivityMemberRecord[] {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return [];
    }
    const table = this.activityMembersCollection();
    return (table.idsByOwnerKey[`asset:${normalizedAssetId}`] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is ActivityMemberRecord => Boolean(record));
  }

  private activityMembersCollection(): ActivityMembersRecordCollection {
    return this.normalizeActivityMembersCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
  }

  private normalizeActivityMembersCollection(value: unknown): ActivityMembersRecordCollection {
    const raw = value as Partial<ActivityMembersRecordCollection> | null | undefined;
    return {
      byId: raw?.byId && typeof raw.byId === 'object'
        ? { ...(raw.byId as Record<string, ActivityMemberRecord>) }
        : {},
      ids: Array.isArray(raw?.ids) ? raw.ids.map(id => String(id)) : [],
      idsByOwnerKey: this.cloneActivityOwnerKeyIndex(raw?.idsByOwnerKey)
    };
  }

  private cloneActivityOwnerKeyIndex(index: Record<string, readonly string[] | string[] | undefined> | undefined): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerKey, ids] of Object.entries(index ?? {})) {
      if (!ownerKey.trim() || !Array.isArray(ids)) {
        continue;
      }
      next[ownerKey] = ids.map(id => String(id)).filter(id => id.length > 0);
    }
    return next;
  }

  private promotedAssetRequests(record: AssetRecord, targetUserId: string): AppDTOs.AssetMemberRequestDTO[] {
    const normalizedTargetUserId = targetUserId.trim();
    const targetUser = this.resolveAssetRoleDemoUser(normalizedTargetUserId, record);
    let promotedExistingRequest = false;
    const next = record.requests.map(request => {
      const cloned = LocalAssetsMapper.cloneRequest(request);
      if (`${cloned.userId ?? ''}`.trim() !== normalizedTargetUserId) {
        return cloned;
      }
      promotedExistingRequest = true;
      return {
        ...cloned,
        status: 'accepted' as AppConstants.AssetRequestStatus,
        note: 'Promoted to asset manager.',
        menuActions: []
      };
    });
    if (!promotedExistingRequest) {
      next.push({
        id: `${record.id}:manager:${normalizedTargetUserId}`,
        userId: normalizedTargetUserId,
        name: targetUser.name,
        initials: targetUser.initials,
        gender: targetUser.gender,
        status: 'accepted',
        note: 'Promoted to asset manager.',
        requestKind: 'manual',
        requestedAtIso: new Date().toISOString(),
        booking: null,
        menuActions: []
      });
    }
    return next;
  }

  private upsertDemoAssetManagerRecord(
    state: ReturnType<LocalMemoryDb['read']>,
    asset: AssetRecord,
    actorUserId: string,
    targetUserId: string,
    now: Date
  ): ReturnType<LocalMemoryDb['read']> {
    const ownerKey = `asset:${asset.id}`;
    const table = this.normalizeActivityMembersCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);
    const existing = (table.idsByOwnerKey[ownerKey] ?? [])
      .map(id => table.byId[id])
      .find(record => record?.userId === targetUserId) ?? null;
    const targetUser = this.resolveAssetRoleDemoUser(targetUserId, asset);
    const recordId = existing?.id ?? `${asset.id}:manager:${targetUserId}`;
    const nowIso = now.toISOString();
    const record: ActivityMemberRecord = {
      ...(existing ?? {}),
      id: recordId,
      userId: targetUser.id,
      name: targetUser.name,
      initials: targetUser.initials,
      gender: targetUser.gender,
      city: targetUser.city || asset.city,
      statusText: 'Can help manage this asset.',
      role: 'Manager',
      status: 'accepted',
      pendingSource: null,
      requestKind: null,
      invitedByUserId: null,
      invitedByActiveUser: false,
      metAtIso: existing?.metAtIso ?? nowIso,
      actionAtIso: nowIso,
      metWhere: asset.title,
      avatarUrl: AppUtils.firstImageUrl(targetUser.images),
      profile: targetUser,
      ownerType: 'asset',
      ownerId: asset.id,
      ownerKey,
      createdMs: Number.isFinite(Number(existing?.createdMs)) ? Number(existing?.createdMs) : now.getTime(),
      updatedMs: now.getTime(),
      createdAtIso: existing?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso,
      updatedUser: actorUserId
    } as ActivityMemberRecord;
    const nextIds = table.ids.includes(recordId) ? [...table.ids] : [recordId, ...table.ids];
    const nextIdsByOwnerKey = this.cloneActivityOwnerKeyIndex(table.idsByOwnerKey);
    const bucket = nextIdsByOwnerKey[ownerKey] ?? [];
    nextIdsByOwnerKey[ownerKey] = bucket.includes(recordId) ? [...bucket] : [recordId, ...bucket];
    return {
      ...state,
      [ACTIVITY_MEMBERS_TABLE_NAME]: {
        byId: {
          ...table.byId,
          [recordId]: record
        },
        ids: nextIds,
        idsByOwnerKey: nextIdsByOwnerKey
      }
    };
  }

  private resolveAssetRoleDemoUser(userId: string, asset: AssetRecord): UserDto {
    const normalizedUserId = userId.trim();
    const users = this.queryUsers();
    const match = users.find(user => user.id === normalizedUserId);
    if (match) {
      return match;
    }
    const template = users[AppUtils.hashText(`${asset.id}:${normalizedUserId}`) % Math.max(1, users.length)];
    return {
      ...(template ?? users[0]),
      id: normalizedUserId,
      name: normalizedUserId || 'Asset member',
      initials: AppUtils.initialsFromText(normalizedUserId || 'Asset member'),
      city: asset.city,
      gender: template?.gender ?? 'man'
    };
  }

  private resolveMenuActions(record: AssetRecord, viewerUserId: string): string[] {
    const normalizedViewerUserId = viewerUserId.trim();
    if (!normalizedViewerUserId) {
      return [];
    }
    const isOwner = record.ownerUserId === normalizedViewerUserId;
    const isManager = isOwner || this.isAcceptedAssetManager(record.id, normalizedViewerUserId);
    if (!isManager) {
      return ['share'];
    }
    const actions: string[] = [];
    const status = LocalAssetsMapper.normalizeAssetStatus(record.status);
    if (status === 'UR' && this.isActiveDemoUser(normalizedViewerUserId)) {
      actions.push('takeOver');
    }
    actions.push('share');
    if (isOwner && !this.isSuppressedAssetStatus(status)) {
      actions.push('edit');
      actions.push('delete');
    }
    return actions;
  }

  private canTakeOverAsset(record: AssetRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !this.isActiveDemoUser(normalizedUserId)) {
      return false;
    }
    return record.ownerUserId === normalizedUserId || this.isAcceptedAssetManager(record.id, normalizedUserId);
  }

  private canManageAssetMembers(record: AssetRecord, userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !this.isActiveDemoUser(normalizedUserId) || LocalAssetsMapper.normalizeAssetStatus(record.status) === 'T') {
      return false;
    }
    return record.ownerUserId === normalizedUserId || this.isAcceptedAssetManager(record.id, normalizedUserId);
  }

  private resolveRequestMenuActions(
    record: AssetRecord,
    request: AppDTOs.AssetMemberRequestDTO,
    viewerUserId: string
  ): string[] {
    const normalizedViewerUserId = viewerUserId.trim();
    const targetUserId = `${request.userId ?? ''}`.trim();
    if (!normalizedViewerUserId
      || !targetUserId
      || request.status !== 'accepted'
      || targetUserId === record.ownerUserId
      || !this.canManageAssetMembers(record, normalizedViewerUserId)
      || !this.isActiveDemoUser(targetUserId)
      || this.isAcceptedAssetManager(record.id, targetUserId)) {
      return [];
    }
    return ['makeManager'];
  }

  private isAcceptedAssetManager(assetId: string, userId: string): boolean {
    const normalizedUserId = userId.trim();
    return this.assetMemberRecords(assetId)
      .some(record => record.userId === normalizedUserId
        && record.status === 'accepted'
        && this.isAssetManagerRole(record.role));
  }

  private isAssetManagerRole(role: string | null | undefined): boolean {
    return role === 'Manager' || role === 'Admin';
  }

  private isSuppressedAssetStatus(status: string | null | undefined): boolean {
    const normalized = LocalAssetsMapper.normalizeAssetStatus(status);
    return normalized === 'UR' || normalized === 'B' || normalized === 'D' || normalized === 'I' || normalized === 'T';
  }

  private isActiveDemoUser(userId: string): boolean {
    const user = this.queryUsers().find(item => item.id === userId.trim()) as (UserDto & { status?: string; profileStatus?: string }) | undefined;
    const status = `${user?.status ?? ''}`.trim();
    const profileStatus = `${user?.profileStatus ?? ''}`.trim();
    return status !== 'B'
      && status !== 'D'
      && status !== 'I'
      && profileStatus !== 'blocked'
      && profileStatus !== 'deleted'
      && profileStatus !== 'inactive';
  }

  private readOwnerAssets(ownerUserId: string): AppDTOs.AssetDTO[] {
    const state = this.memoryDb.read();
    const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
    const requestTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
    const records = (table.idsByOwnerUserId[ownerUserId] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is AssetRecord => Boolean(record))
      .filter(record => !this.isSuppressedAssetStatus(record.status))
      .sort((left, right) => right.updatedMs - left.updatedMs);
    const metricsByAssetId = this.assetRequestMetricsByAssetId(requestTable, records);
    return records.map(record => this.toAssetDto(record, ownerUserId, metricsByAssetId.get(record.id)));
  }

  private readVisibleAssets(activeUserId: string): AppDTOs.AssetDTO[] {
    const state = this.memoryDb.read();
    const requestTable = this.normalizeAssetRequestsCollection(state[ASSET_REQUESTS_TABLE_NAME]);
    const records = this.readVisibleAssetRecords(activeUserId, state);
    const metricsByAssetId = this.assetRequestMetricsByAssetId(requestTable, records);
    return records.map(record => this.toAssetDto(record, activeUserId, metricsByAssetId.get(record.id)));
  }

  private readVisibleAssetRecords(activeUserId: string, state = this.memoryDb.read()): AssetRecord[] {
    const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
    const visibleOwnerIds = new Set(this.queryVisibleExploreOwners(activeUserId).map(user => user.id));
    const viewerAffinity = this.queryUserAffinity(activeUserId);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is AssetRecord => Boolean(record))
      .filter(record => !this.isSuppressedAssetStatus(record.status))
      .filter(record => record.ownerUserId !== activeUserId)
      .filter(record => visibleOwnerIds.size === 0 || visibleOwnerIds.has(record.ownerUserId))
      .filter(record => record.visibility === 'Public'
        || (record.visibility === 'Friends only' && UserProfileState.isFriendOfActiveUser(record.ownerUserId, activeUserId)))
      .sort((left, right) => this.compareVisibleAssetRecords(left, right, viewerAffinity));
  }

  private assetRequestMetricsByAssetId(
    requestTable: AssetRequestsRecordCollection,
    records: readonly AssetRecord[]
  ): Map<string, AppDTOs.AssetRequestMetricsDTO> {
    const metricsByAssetId = new Map<string, AppDTOs.AssetRequestMetricsDTO>();
    for (const record of records) {
      const requests = this.assetRequestRecordsForAsset(requestTable, record);
      metricsByAssetId.set(
        record.id,
        LocalAssetsMapper.toAssetRequestMetrics(requests)
      );
    }
    return metricsByAssetId;
  }

  private assetRequestRecordsForAsset(
    requestTable: AssetRequestsRecordCollection,
    record: AssetRecord
  ): AssetRequestRecord[] {
    return (requestTable.idsByOwnerKey[this.assetRequestOwnerKey(record.id)] ?? [])
      .map(id => requestTable.byId[id])
      .filter((request): request is AssetRequestRecord =>
        Boolean(request)
        && request.assetId === record.id
        && request.ownerUserId === record.ownerUserId);
  }

  private compareVisibleAssetRecords(
    left: AssetRecord,
    right: AssetRecord,
    viewerAffinity: number
  ): number {
    const scoreDelta = this.assetExploreScore(right, viewerAffinity) - this.assetExploreScore(left, viewerAffinity);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
  }

  private normalizeAssetExploreOrder(order: AppDTOs.AssetExploreOrder | null | undefined): AppDTOs.AssetExploreOrder {
    return order === 'lowest-price' || order === 'fewest-policies'
      ? order
      : 'availability';
  }

  private parseAssetExploreCursor(cursor: string | null | undefined): number | null {
    const value = Math.trunc(Number(`${cursor ?? ''}`.trim()));
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  private toAssetExploreProjection(
    record: AssetRecord,
    startAtIso: string,
    endAtIso: string
  ): AssetExploreRecordProjection {
    return {
      record,
      availability: this.availableQuantityForWindow(record, startAtIso, endAtIso),
      price: this.assetPriceAmount(record),
      policyCount: record.policiesEnabled === true ? (record.policies ?? []).length : 0
    };
  }

  private compareAssetExploreProjections(
    left: AssetExploreRecordProjection,
    right: AssetExploreRecordProjection,
    order: AppDTOs.AssetExploreOrder
  ): number {
    if (order === 'lowest-price') {
      return (left.price - right.price)
        || (right.availability - left.availability)
        || this.compareAssetExploreProjectionIdentity(left, right);
    }
    if (order === 'fewest-policies') {
      return (left.policyCount - right.policyCount)
        || (right.availability - left.availability)
        || this.compareAssetExploreProjectionIdentity(left, right);
    }
    return (right.availability - left.availability)
      || (left.price - right.price)
      || this.compareAssetExploreProjectionIdentity(left, right);
  }

  private compareAssetExploreProjectionIdentity(
    left: AssetExploreRecordProjection,
    right: AssetExploreRecordProjection
  ): number {
    return left.record.title.localeCompare(right.record.title)
      || (left.record.ownerName ?? '').localeCompare(right.record.ownerName ?? '')
      || left.record.id.localeCompare(right.record.id);
  }

  private availableQuantityForWindow(record: AssetRecord, startAtIso: string, endAtIso: string): number {
    const totalQuantity = AssetCardBuilder.storedQuantityValue(record);
    const overlappingCommitted = (record.requests ?? [])
      .filter(request => request.status === 'accepted' || request.requestKind === 'manual')
      .filter(request => request.booking?.inventoryApplied !== true)
      .filter(request => this.isAssetRequestWindowOverlap(request, startAtIso, endAtIso))
      .reduce((sum, request) => sum + this.assetRequestQuantity(request), 0);
    return Math.max(0, totalQuantity - overlappingCommitted);
  }

  private assetRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 1));
  }

  private isAssetRequestWindowOverlap(
    request: AppDTOs.AssetMemberRequestDTO,
    startAtIso: string,
    endAtIso: string
  ): boolean {
    const requestStart = this.parseLocalDateMs(request.booking?.startAtIso);
    const requestEnd = this.parseLocalDateMs(request.booking?.endAtIso);
    const windowStart = this.parseLocalDateMs(startAtIso);
    const windowEnd = this.parseLocalDateMs(endAtIso);
    if (requestStart !== null && requestEnd !== null && windowStart !== null && windowEnd !== null) {
      return requestStart < windowEnd && windowStart < requestEnd;
    }
    const requestWindow = [
      `${request.booking?.eventId ?? ''}`.trim(),
      `${request.booking?.subEventId ?? ''}`.trim(),
      `${request.booking?.slotKey ?? ''}`.trim(),
      `${request.booking?.timeframe ?? ''}`.trim()
    ].filter(Boolean).join('|');
    const targetWindow = [startAtIso.trim(), endAtIso.trim()].filter(Boolean).join('|');
    return Boolean(requestWindow && targetWindow && requestWindow === targetWindow);
  }

  private parseLocalDateMs(value: string | null | undefined): number | null {
    const parsed = AppUtils.isoLocalDateTimeToDate(`${value ?? ''}`.trim());
    return parsed ? parsed.getTime() : null;
  }

  private assetPriceAmount(record: AssetRecord): number {
    const amount = Number(record.pricing?.basePrice);
    return Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }

  private assetExploreScore(record: AssetRecord, viewerAffinity: number): number {
    const assetAffinity = this.assetAffinityOrderValue(record);
    const boost = this.assetBoostOrderValue(record);
    if (viewerAffinity > 0 && assetAffinity > 0) {
      return boost - (Math.abs(viewerAffinity - assetAffinity) / LocalAssetsRepository.AFFINITY_DISTANCE_BOOST_SCALE);
    }
    return boost + (assetAffinity / LocalAssetsRepository.AFFINITY_DISTANCE_BOOST_SCALE);
  }

  private assetAffinityOrderValue(record: AssetRecord): number {
    const stored = Number(record.affinity);
    return Number.isFinite(stored) ? Math.max(0, Math.trunc(stored)) : this.resolveAssetAffinity(record);
  }

  private assetBoostOrderValue(record: AssetRecord): number {
    const stored = Number(record.boost);
    return Number.isFinite(stored) ? Math.max(0, stored) : this.resolveAssetBoost(record);
  }

  private toAssetDto(
    record: AssetRecord,
    viewerUserId = '',
    requestMetrics?: AppDTOs.AssetRequestMetricsDTO | null
  ): AppDTOs.AssetDTO {
    return LocalAssetsMapper.toAssetDto(record, {
      viewerUserId,
      requestMetrics,
      resolveMenuActions: (assetRecord, activeUserId) => this.resolveMenuActions(assetRecord, activeUserId),
      resolveRequestMenuActions: (assetRecord, request, activeUserId) => this.resolveRequestMenuActions(assetRecord, request, activeUserId)
    });
  }

  private toAssetDetailDto(
    record: AssetRecord,
    viewerUserId = '',
    requestMetrics?: AppDTOs.AssetRequestMetricsDTO | null
  ): AppDTOs.AssetDetailDTO {
    return LocalAssetsMapper.toAssetDetailDto(record, {
      viewerUserId,
      requestMetrics,
      resolveMenuActions: (assetRecord, activeUserId) => this.resolveMenuActions(assetRecord, activeUserId),
      resolveRequestMenuActions: (assetRecord, request, activeUserId) => this.resolveRequestMenuActions(assetRecord, request, activeUserId)
    });
  }

  private mergeAssetRecord(
    existing: AssetRecord | undefined,
    incoming: AssetRecord,
    timestampMs: number,
    mode: 'summary' | 'detail'
  ): AssetRecord {
    const timestampIso = new Date(timestampMs).toISOString();
    const preserveDetail = mode === 'summary';
    return {
      ...incoming,
      details: preserveDetail ? (existing?.details ?? incoming.details) : incoming.details,
      sourceLink: preserveDetail ? (existing?.sourceLink ?? incoming.sourceLink) : incoming.sourceLink,
      routes: preserveDetail
        ? [...(existing?.routes ?? incoming.routes ?? [])]
        : [...(incoming.routes ?? [])],
      topics: preserveDetail
        ? [...(existing?.topics ?? incoming.topics ?? [])]
        : [...(incoming.topics ?? [])],
      policies: preserveDetail
        ? (existing?.policies ?? incoming.policies ?? []).map(item => ({ ...item }))
        : (incoming.policies ?? []).map(item => ({ ...item })),
      policiesEnabled: preserveDetail
        ? (existing?.policiesEnabled ?? incoming.policiesEnabled ?? false)
        : incoming.policiesEnabled === true,
      pricing: preserveDetail
        ? (existing?.pricing ? PricingBuilder.clonePricingConfig(existing.pricing) : incoming.pricing)
        : (incoming.pricing ? PricingBuilder.clonePricingConfig(incoming.pricing) : incoming.pricing),
      visibility: incoming.visibility ?? existing?.visibility ?? 'Public',
      status: incoming.status ?? existing?.status ?? 'A',
      statusBeforeSuppression: existing?.statusBeforeSuppression ?? incoming.statusBeforeSuppression ?? null,
      ownerName: incoming.ownerName ?? existing?.ownerName,
      requests: incoming.requests.map(request => LocalAssetsMapper.cloneRequest(request)),
      menuActions: [...(incoming.menuActions ?? existing?.menuActions ?? [])],
      createdAtIso: existing?.createdAtIso ?? timestampIso,
      updatedAtIso: timestampIso,
      createdMs: existing?.createdMs ?? timestampMs,
      updatedMs: timestampMs,
      affinity: existing?.affinity,
      boost: existing?.boost
    };
  }

  private withResolvedAssetRelevance(
    record: AssetRecord,
    userAffinityById?: ReadonlyMap<string, number>,
    cloneNested = true
  ): AssetRecord {
    return {
      ...record,
      affinity: this.resolveAssetAffinity(record, userAffinityById),
      boost: this.resolveAssetBoost(record),
      routes: cloneNested ? [...(record.routes ?? [])] : (record.routes ?? []),
      topics: cloneNested ? [...(record.topics ?? [])] : (record.topics ?? []),
      policiesEnabled: record.policiesEnabled === true,
      policies: cloneNested ? (record.policies ?? []).map(item => ({ ...item })) : (record.policies ?? []),
      pricing: cloneNested && record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : record.pricing,
      requests: cloneNested ? record.requests.map(request => LocalAssetsMapper.cloneRequest(request)) : record.requests,
      menuActions: cloneNested ? [...(record.menuActions ?? [])] : (record.menuActions ?? [])
    };
  }

  private resolveAssetAffinity(record: AssetRecord, userAffinityById?: ReadonlyMap<string, number>): number {
    const ownerAffinity = userAffinityById?.get(record.ownerUserId) ?? this.queryUserAffinity(record.ownerUserId);
    const tokenScore = AppUtils.hashText([
      record.type,
      record.title,
      record.subtitle,
      record.category,
      record.city,
      record.visibility,
      record.details,
      ...(record.routes ?? [])
    ].join('|')) % 997;
    return Math.max(0, Math.trunc(ownerAffinity + (tokenScore * 83)));
  }

  private resolveAssetBoost(record: AssetRecord): number {
    const acceptedRequests = record.requests.filter(request => request.status === 'accepted').length;
    const capacityAvailable = Math.max(0, Math.trunc(Number(record.capacityTotal) || 0) - acceptedRequests);
    const quantity = Math.max(0, Math.trunc(Number(record.quantity) || 0));
    const requestCount = Math.max(0, record.requests.length);
    return Math.max(0, (capacityAvailable * 7) + (quantity * 11) + (requestCount * 13));
  }

  private queryUserAffinity(userId: string): number {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return 0;
    }
    const user = this.queryUsers().find(item => item.id === normalizedUserId);
    return Math.max(0, Math.trunc(Number(user?.affinity) || 0));
  }

  private normalizeAssetRequestsCollection(value: unknown): AssetRequestsRecordCollection {
    const source = value as Partial<AssetRequestsRecordCollection> | null | undefined;
    return {
      byId: source?.byId && typeof source.byId === 'object'
        ? { ...(source.byId as Record<string, AssetRequestRecord>) }
        : {},
      ids: Array.isArray(source?.ids)
        ? source.ids.map(id => String(id)).filter(Boolean)
        : [],
      idsByOwnerKey: this.cloneAssetRequestOwnerKeyIndex(source?.idsByOwnerKey)
    };
  }

  private cloneAssetRequestOwnerKeyIndex(
    index: Record<string, readonly string[] | string[] | undefined> | undefined
  ): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerKey, ids] of Object.entries(index ?? {})) {
      if (!ownerKey.trim() || !Array.isArray(ids)) {
        continue;
      }
      next[ownerKey] = ids.map(id => String(id)).filter(id => id.length > 0);
    }
    return next;
  }

  private assetRequestOwnerKey(assetId: string): string {
    return `asset:${assetId.trim()}`;
  }

  private assetRequestProjectionId(assetId: string, requestId: string): string {
    return `${assetId.trim()}:request:${requestId.trim()}`;
  }

  private synchronizeAssetRequestCollection(
    table: AssetRequestsRecordCollection,
    asset: AssetRecord,
    previousRequests: readonly AssetMemberRequestRecord[] = []
  ): AssetRequestsRecordCollection {
    const ownerKey = this.assetRequestOwnerKey(asset.id);
    const existingIds = table.idsByOwnerKey[ownerKey] ?? [];
    const nextById = { ...table.byId };
    const retainedIds = new Set<string>();

    for (const request of asset.requests) {
      const requestId = `${request.id ?? ''}`.trim();
      if (!requestId) {
        continue;
      }
      const projectionId = this.assetRequestProjectionId(asset.id, requestId);
      retainedIds.add(projectionId);
      const existing = nextById[projectionId];
      const requestedAtIso = `${request.requestedAtIso ?? ''}`.trim();
      const requestedAtMs = requestedAtIso ? Date.parse(requestedAtIso) : Number.NaN;
      const createdMs = Number.isFinite(Number(existing?.createdMs))
        ? Number(existing?.createdMs)
        : Number.isFinite(requestedAtMs)
          ? requestedAtMs
          : asset.createdMs;
      const createdAtIso = `${existing?.createdAtIso ?? ''}`.trim()
        || requestedAtIso
        || asset.createdAtIso;
      const cloned = LocalAssetsMapper.cloneRequest(request);
      nextById[projectionId] = {
        ...cloned,
        id: projectionId,
        requestId,
        assetId: asset.id,
        ownerUserId: asset.ownerUserId,
        ownerKey,
        assetCapacity: Math.max(0, Math.trunc(Number(asset.capacityTotal) || 0)),
        createdMs,
        updatedMs: asset.updatedMs,
        createdAtIso,
        updatedAtIso: asset.updatedAtIso
      };
    }

    const removedIds = new Set(
      previousRequests
        .map(request => `${request.id ?? ''}`.trim())
        .filter(Boolean)
        .map(requestId => this.assetRequestProjectionId(asset.id, requestId))
        .filter(projectionId => !retainedIds.has(projectionId))
    );
    for (const removedId of removedIds) {
      delete nextById[removedId];
    }
    const nextIds = table.ids.filter(id => !removedIds.has(id));
    for (const projectionId of retainedIds) {
      if (!nextIds.includes(projectionId)) {
        nextIds.unshift(projectionId);
      }
    }
    const nextIdsByOwnerKey = this.cloneAssetRequestOwnerKeyIndex(table.idsByOwnerKey);
    nextIdsByOwnerKey[ownerKey] = [
      ...existingIds.filter(id => !removedIds.has(id)),
      ...[...retainedIds].filter(id => !existingIds.includes(id))
    ];
    return {
      byId: nextById,
      ids: nextIds,
      idsByOwnerKey: nextIdsByOwnerKey
    };
  }

  private deleteAssetRequestCollection(
    table: AssetRequestsRecordCollection,
    assetId: string
  ): AssetRequestsRecordCollection {
    const ownerKey = this.assetRequestOwnerKey(assetId);
    const deletedIds = new Set(table.idsByOwnerKey[ownerKey] ?? []);
    if (deletedIds.size === 0) {
      return table;
    }
    const nextById = { ...table.byId };
    deletedIds.forEach(id => delete nextById[id]);
    const nextIdsByOwnerKey = this.cloneAssetRequestOwnerKeyIndex(table.idsByOwnerKey);
    delete nextIdsByOwnerKey[ownerKey];
    return {
      byId: nextById,
      ids: table.ids.filter(id => !deletedIds.has(id)),
      idsByOwnerKey: nextIdsByOwnerKey
    };
  }

  private normalizeCollection(value: unknown): AssetsRecordCollection {
    const source = value as Partial<AssetsRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, AssetRecord>) }
      : {};
    const ids = Array.isArray(source?.ids)
      ? source.ids.map(id => String(id))
      : [];
    const idsByOwnerUserId: Record<string, string[]> = {};
    if (source?.idsByOwnerUserId && typeof source.idsByOwnerUserId === 'object') {
      for (const [ownerUserId, ownerIds] of Object.entries(source.idsByOwnerUserId)) {
        if (!ownerUserId.trim() || !Array.isArray(ownerIds)) {
          continue;
        }
        idsByOwnerUserId[ownerUserId] = ownerIds
          .map(id => String(id))
          .filter(id => Boolean(byId[id]));
      }
    }
    for (const id of ids) {
      const record = byId[id];
      const ownerUserId = `${record?.ownerUserId ?? ''}`.trim();
      if (!ownerUserId) {
        continue;
      }
      const bucket = idsByOwnerUserId[ownerUserId] ?? [];
      if (!bucket.includes(id)) {
        bucket.push(id);
      }
      idsByOwnerUserId[ownerUserId] = bucket;
    }
    return {
      byId,
      ids,
      idsByOwnerUserId
    };
  }

  private queryVisibleExploreOwners(activeUserId: string): UserDto[] {
    const allUsers = this.queryUsers();
    const prioritizedFriends = UserProfileState.friendUsersForActiveUser(
      allUsers,
      activeUserId,
      Math.min(8, LocalAssetsRepository.VISIBLE_EXPLORE_OWNER_LIMIT)
    );
    const prioritizedFriendIds = new Set(prioritizedFriends.map(user => user.id));
    const remainingUsers = allUsers
      .filter(user => user.id !== activeUserId)
      .filter(user => !prioritizedFriendIds.has(user.id))
      .sort((left, right) => left.id.localeCompare(right.id));
    return [
      ...prioritizedFriends,
      ...remainingUsers.slice(0, Math.max(0, LocalAssetsRepository.VISIBLE_EXPLORE_OWNER_LIMIT - prioritizedFriends.length))
    ];
  }

  private upsertRecordCollection(
    table: AssetsRecordCollection,
    record: AssetRecord
  ): AssetsRecordCollection {
    const nextById = {
      ...table.byId,
      [record.id]: this.cloneRecordForStorage(record)
    };
    const nextIds = table.ids.includes(record.id) ? [...table.ids] : [record.id, ...table.ids];
    const nextIdsByOwnerUserId = { ...table.idsByOwnerUserId };
    const previousOwnerUserId = table.byId[record.id]?.ownerUserId?.trim() ?? '';
    if (previousOwnerUserId && previousOwnerUserId !== record.ownerUserId) {
      nextIdsByOwnerUserId[previousOwnerUserId] = (nextIdsByOwnerUserId[previousOwnerUserId] ?? []).filter(id => id !== record.id);
    }
    const ownerBucket = nextIdsByOwnerUserId[record.ownerUserId] ?? [];
    nextIdsByOwnerUserId[record.ownerUserId] = ownerBucket.includes(record.id)
      ? [...ownerBucket]
      : [record.id, ...ownerBucket];
    return {
      byId: nextById,
      ids: nextIds,
      idsByOwnerUserId: nextIdsByOwnerUserId
    };
  }

  private cloneRecordForStorage(record: AssetRecord): AssetRecord {
    return {
      ...record,
      routes: [...(record.routes ?? [])],
      topics: [...(record.topics ?? [])],
      policiesEnabled: record.policiesEnabled === true,
      policies: (record.policies ?? []).map(item => ({ ...item })),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      requests: record.requests.map(request => LocalAssetsMapper.cloneRequest(request)),
      menuActions: [...(record.menuActions ?? [])]
    };
  }

  private deleteRecordCollection(
    table: AssetsRecordCollection,
    assetId: string
  ): AssetsRecordCollection {
    const current = table.byId[assetId];
    if (!current) {
      return table;
    }
    const nextById = { ...table.byId };
    delete nextById[assetId];
    const nextIds = table.ids.filter(id => id !== assetId);
    const nextIdsByOwnerUserId = { ...table.idsByOwnerUserId };
    nextIdsByOwnerUserId[current.ownerUserId] = (nextIdsByOwnerUserId[current.ownerUserId] ?? []).filter(id => id !== assetId);
    return {
      byId: nextById,
      ids: nextIds,
      idsByOwnerUserId: nextIdsByOwnerUserId
    };
  }
}
