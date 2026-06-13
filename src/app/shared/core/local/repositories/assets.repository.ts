import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder, UserProfileStateBuilder } from '../../../core/base/builders';
import type * as AppTypes from '../../../core/base/models';
import type { UserDto } from '../../contracts/user.interface';
import { LocalMemoryDb } from '../../base/db';
import { LocalAssetsMapper } from '../mappers/asset.mapper';
import { LocalUsersRepository } from './users.repository';
import {
  ASSETS_TABLE_NAME,
  type AssetRecord,
  type AssetsRecordCollection
} from '../entity/asset.entity';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type ActivityMemberRecord,
  type ActivityMembersRecordCollection
} from '../entity/activity.entity';

@Injectable({
  providedIn: 'root'
})
export class LocalAssetsRepository {
  private static readonly VISIBLE_EXPLORE_OWNER_LIMIT = 12;
  private static readonly AFFINITY_DISTANCE_BOOST_SCALE = 10_000;
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly usersRepository = inject(LocalUsersRepository);

  peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readOwnerAssets(normalizedUserId);
  }

  peekOwnedAssetById(userId: string, assetId: string): AppTypes.AssetCard | null {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return null;
    }
    return this.peekOwnedAssetsByUser(userId).find(card => card.id === normalizedAssetId) ?? null;
  }

  peekOwnedAssetsByUsers(userIds: readonly string[]): Map<string, AppTypes.AssetCard[]> {
    const normalizedUserIds = [...new Set(
      userIds
        .map(userId => userId.trim())
        .filter(Boolean)
    )];
    const assetsByUserId = new Map<string, AppTypes.AssetCard[]>(
      normalizedUserIds.map(userId => [userId, []])
    );
    if (normalizedUserIds.length === 0) {
      return assetsByUserId;
    }
    const table = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    for (const userId of normalizedUserIds) {
      const assets = (table.idsByOwnerUserId[userId] ?? [])
        .map(id => table.byId[id])
        .filter((record): record is AssetRecord => Boolean(record))
        .filter(record => !this.isSuppressedAssetStatus(record.status))
        .sort((left, right) => right.updatedMs - left.updatedMs)
        .map(record => this.toAssetCard(record, userId));
      assetsByUserId.set(userId, assets);
    }
    return assetsByUserId;
  }

  async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readOwnerAssets(normalizedUserId);
  }

  async loadFullOwnedAssetById(userId: string, assetId: string): Promise<AppTypes.AssetCard | null> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    return this.readOwnerAssets(normalizedUserId).find(card => card.id === normalizedAssetId) ?? null;
  }

  async queryVisibleAssets(query: AppTypes.AssetExploreQuery): Promise<AppTypes.AssetCard[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedCategory = `${query.category ?? ''}`.trim();
    return this.readVisibleAssets(normalizedUserId)
      .filter(card => card.type === query.type)
      .filter(card => !normalizedCategory || card.category === normalizedCategory);
  }

  peekVisibleAssetById(userId: string, type: AppTypes.AssetType, assetId: string): AppTypes.AssetCard | null {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return null;
    }
    return this.readVisibleAssets(normalizedUserId)
      .find(card => card.type === type && card.id === normalizedAssetId) ?? null;
  }

  async saveOwnedAsset(userId: string, asset: AppTypes.AssetCard): Promise<AppTypes.AssetCard> {
    const normalizedUserId = userId.trim();
    const normalizedAsset = LocalAssetsMapper.normalizeCard(asset);
    if (!normalizedUserId || !normalizedAsset) {
      return asset;
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      const existing = table.byId[normalizedAsset.id];
      const nextRecord = this.withResolvedAssetRelevance({
        ...normalizedAsset,
        ownerUserId: normalizedUserId,
        visibility: normalizedAsset.visibility ?? existing?.visibility ?? 'Public',
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso,
        createdMs: existing?.createdMs ?? nowMs,
        updatedMs: nowMs
      });
      return {
        ...state,
        [ASSETS_TABLE_NAME]: this.upsertRecordCollection(table, nextRecord)
      };
    });

    return LocalAssetsMapper.cloneCards([normalizedAsset])[0] ?? normalizedAsset;
  }

  async replaceOwnedAssets(
    userId: string,
    assets: readonly AppTypes.AssetCard[]
  ): Promise<AppTypes.AssetCard[]> {
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
      const nowMs = timestampMs;
      timestampMs += 1;
      nextRecords.push(this.withResolvedAssetRelevance({
        ...asset,
        ownerUserId: normalizedUserId,
        visibility: asset.visibility ?? existing?.visibility ?? 'Public',
        createdAtIso: existing?.createdAtIso ?? new Date(nowMs).toISOString(),
        updatedAtIso: new Date(nowMs).toISOString(),
        createdMs: existing?.createdMs ?? nowMs,
        updatedMs: nowMs
      }));
      seenIds.add(asset.id);
    }

    this.memoryDb.write(state => {
      let nextTable = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      for (const assetId of ownerIds) {
        if (seenIds.has(assetId)) {
          continue;
        }
        nextTable = this.deleteRecordCollection(nextTable, assetId);
      }
      for (const record of nextRecords) {
        nextTable = this.upsertRecordCollection(nextTable, record);
      }
      return {
        ...state,
        [ASSETS_TABLE_NAME]: nextTable
      };
    });

    return LocalAssetsMapper.cloneCards(normalizedAssets);
  }

  async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    const normalizedAssetId = assetId.trim();
    if (!normalizedUserId || !normalizedAssetId) {
      return;
    }
    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      const current = table.byId[normalizedAssetId];
      if (!current || current.ownerUserId !== normalizedUserId) {
        return state;
      }
      return {
        ...state,
        [ASSETS_TABLE_NAME]: this.deleteRecordCollection(table, normalizedAssetId)
      };
    });
  }

  async takeOverOwnedAsset(userId: string, assetId: string): Promise<AppTypes.AssetCard | null> {
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
    return saved ? this.toAssetCard(saved, normalizedUserId) : null;
  }

  async makeAssetManager(
    userId: string,
    assetId: string,
    targetUserId: string
  ): Promise<AppTypes.AssetCard | null> {
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
    return saved ? this.toAssetCard(saved, normalizedUserId) : null;
  }

  private queryUsers(): UserDto[] {
    return (this.usersRepository.queryGameStackUsers() as UserDto[])
      .filter(user => !UserProfileStateBuilder.isEmptyOnboardingProfileUserId(user.id));
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

  private activityMemberRecords(): ActivityMemberRecord[] {
    const table = this.activityMembersCollection();
    return table.ids
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

  private promotedAssetRequests(record: AssetRecord, targetUserId: string): AppTypes.AssetMemberRequest[] {
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
        status: 'accepted' as AppTypes.AssetRequestStatus,
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
    request: AppTypes.AssetMemberRequest,
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

  private readOwnerAssets(ownerUserId: string): AppTypes.AssetCard[] {
    const table = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    return (table.idsByOwnerUserId[ownerUserId] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is AssetRecord => Boolean(record))
      .filter(record => !this.isSuppressedAssetStatus(record.status))
      .sort((left, right) => right.updatedMs - left.updatedMs)
      .map(record => this.toAssetCard(record, ownerUserId));
  }

  private readVisibleAssets(activeUserId: string): AppTypes.AssetCard[] {
    const table = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const visibleOwnerIds = new Set(this.queryVisibleExploreOwners(activeUserId).map(user => user.id));
    const viewerAffinity = this.queryUserAffinity(activeUserId);
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is AssetRecord => Boolean(record))
      .filter(record => record.ownerUserId !== activeUserId)
      .filter(record => visibleOwnerIds.size === 0 || visibleOwnerIds.has(record.ownerUserId))
      .filter(record => record.visibility === 'Public'
        || (record.visibility === 'Friends only' && UserProfileStateBuilder.isFriendOfActiveUser(record.ownerUserId, activeUserId)))
      .sort((left, right) => this.compareVisibleAssetRecords(left, right, viewerAffinity))
      .map(record => this.toAssetCard(record, activeUserId));
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

  private toAssetCard(record: AssetRecord, viewerUserId = ''): AppTypes.AssetCard {
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      subtitle: record.subtitle,
      category: AssetDefaultsBuilder.normalizeCategory(record.type, record.category),
      city: record.city,
      capacityTotal: record.capacityTotal,
      quantity: AssetCardBuilder.storedQuantityValue({
        type: record.type,
        quantity: record.quantity,
        capacityTotal: record.capacityTotal
      }),
      details: record.details,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      routes: [...(record.routes ?? [])],
      topics: [...(record.topics ?? [])],
      policies: (record.policies ?? []).map(item => ({ ...item })),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      visibility: record.visibility,
      status: LocalAssetsMapper.normalizeAssetStatus(record.status),
      ownerUserId: record.ownerUserId,
      ownerName: record.ownerName,
      requests: record.requests.map(request => ({
        ...LocalAssetsMapper.cloneRequest(request),
        menuActions: this.resolveRequestMenuActions(record, request, viewerUserId)
      })),
      menuActions: this.resolveMenuActions(record, viewerUserId)
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

  private cloneOwnerUserIdIndex(index: Record<string, readonly string[] | string[] | undefined>): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerUserId, ids] of Object.entries(index)) {
      if (!ownerUserId.trim() || !Array.isArray(ids)) {
        continue;
      }
      next[ownerUserId] = ids.map(id => String(id)).filter(id => id.length > 0);
    }
    return next;
  }

  private queryVisibleExploreOwners(activeUserId: string): UserDto[] {
    const allUsers = this.queryUsers();
    const prioritizedFriends = UserProfileStateBuilder.friendUsersForActiveUser(
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
