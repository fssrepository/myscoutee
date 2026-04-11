import { Injectable, inject } from '@angular/core';

import { PricingBuilder } from '../../../core/base/builders';
import { DemoAssetBuilder, DemoUserSeedBuilder } from '../builders';
import type * as AppTypes from '../../../core/base/models';
import type { DemoUser } from '../../base/interfaces/user.interface';
import { HttpAssetsRepository } from '../../http/repositories/assets.repository';
import { AppMemoryDb } from '../../base/db';
import { DemoUsersRepository } from './users.repository';
import {
  ASSETS_TABLE_NAME,
  type DemoAssetRecord,
  type DemoAssetsRecordCollection
} from '../models/assets.model';

@Injectable({
  providedIn: 'root'
})
export class DemoAssetsRepository extends HttpAssetsRepository {
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly initializedOwnerUserIds = new Set<string>();

  init(ownerUserIds?: readonly string[]): void {
    const normalizedOwnerIds = Array.from(new Set(
      (ownerUserIds ?? this.querySeedUsers().map(user => user.id))
        .map(userId => userId.trim())
        .filter(userId => userId.length > 0)
    ));
    if (normalizedOwnerIds.length === 0) {
      return;
    }

    const ownerIdsToInitialize = normalizedOwnerIds.filter(ownerUserId => !this.initializedOwnerUserIds.has(ownerUserId));
    if (ownerIdsToInitialize.length === 0) {
      return;
    }

    let nextTable = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    let changed = false;

    for (const ownerUserId of ownerIdsToInitialize) {
      if ((nextTable.idsByOwnerUserId[ownerUserId] ?? []).length > 0) {
        this.initializedOwnerUserIds.add(ownerUserId);
        continue;
      }
      const records = this.buildSeededOwnerRecords(ownerUserId);
      if (records.length === 0) {
        this.initializedOwnerUserIds.add(ownerUserId);
        continue;
      }
      for (const record of records) {
        nextTable = this.upsertRecordCollection(nextTable, record);
      }
      this.initializedOwnerUserIds.add(ownerUserId);
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.memoryDb.write(state => ({
      ...state,
      [ASSETS_TABLE_NAME]: nextTable
    }));
  }

  override peekOwnedAssetsByUser(userId: string): AppTypes.AssetCard[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.readOwnerAssets(normalizedUserId);
  }

  override async queryOwnedAssetsByUser(userId: string): Promise<AppTypes.AssetCard[]> {
    return this.peekOwnedAssetsByUser(userId);
  }

  override async saveOwnedAsset(userId: string, asset: AppTypes.AssetCard): Promise<AppTypes.AssetCard> {
    const normalizedUserId = userId.trim();
    const normalizedAsset = this.normalizeCard(asset);
    if (!normalizedUserId || !normalizedAsset) {
      return asset;
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ASSETS_TABLE_NAME]);
      const existing = table.byId[normalizedAsset.id];
      const nextRecord: DemoAssetRecord = {
        ...normalizedAsset,
        ownerUserId: normalizedUserId,
        visibility: existing?.visibility ?? 'Invitation only',
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso,
        createdMs: existing?.createdMs ?? nowMs,
        updatedMs: nowMs
      };
      return {
        ...state,
        [ASSETS_TABLE_NAME]: this.upsertRecordCollection(table, nextRecord)
      };
    });

      return {
        ...normalizedAsset,
        routes: [...(normalizedAsset.routes ?? [])],
        pricing: normalizedAsset.pricing ? PricingBuilder.clonePricingConfig(normalizedAsset.pricing) : undefined,
        requests: normalizedAsset.requests.map(request => ({ ...request }))
      };
  }

  override async replaceOwnedAssets(
    userId: string,
    assets: readonly AppTypes.AssetCard[]
  ): Promise<AppTypes.AssetCard[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedAssets = this.normalizeCards(assets);
    const currentTable = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const ownerIds = [...(currentTable.idsByOwnerUserId[normalizedUserId] ?? [])];
    const seenIds = new Set<string>();
    const nextRecords: DemoAssetRecord[] = [];
    let timestampMs = Date.now();

    for (const asset of normalizedAssets) {
      const existing = currentTable.byId[asset.id];
      const nowMs = timestampMs;
      timestampMs += 1;
      nextRecords.push({
        ...asset,
        ownerUserId: normalizedUserId,
        visibility: existing?.visibility ?? 'Invitation only',
        createdAtIso: existing?.createdAtIso ?? new Date(nowMs).toISOString(),
        updatedAtIso: new Date(nowMs).toISOString(),
        createdMs: existing?.createdMs ?? nowMs,
        updatedMs: nowMs
      });
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

    return normalizedAssets.map(asset => ({
      ...asset,
      routes: [...(asset.routes ?? [])],
      pricing: asset.pricing ? PricingBuilder.clonePricingConfig(asset.pricing) : undefined,
      requests: asset.requests.map(request => ({ ...request }))
    }));
  }

  override async deleteOwnedAsset(userId: string, assetId: string): Promise<void> {
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

  private buildSeededOwnerRecords(ownerUserId: string): DemoAssetRecord[] {
    const allUsers = this.querySeedUsers();
    const owner = allUsers.find(user => user.id === ownerUserId) ?? allUsers[0] ?? null;
    if (!owner) {
      return [];
    }
    const otherUsers = allUsers.filter(user => user.id !== ownerUserId);
    const baseCards = DemoAssetBuilder.buildSampleAssetCards(allUsers as DemoUser[]);
    const createdAt = new Date('2026-02-01T12:00:00.000Z');
    return baseCards.map((card, index) => {
      const createdMs = createdAt.getTime() + (index * 60_000);
      const createdAtIso = new Date(createdMs).toISOString();
      const imageUrl = DemoAssetBuilder.defaultAssetImage(card.type, `${ownerUserId}-${card.id}`);
      return {
        ...card,
        id: `${ownerUserId}:${card.id}`,
        city: owner.city || card.city,
        imageUrl,
        sourceLink: imageUrl,
        pricing: PricingBuilder.createSamplePricingConfig(card.type === 'Supplies' ? 'fixed' : 'hybrid'),
        ownerUserId,
        visibility: 'Invitation only',
        requests: this.buildSeededRequests(ownerUserId, card.type, otherUsers, index),
        createdAtIso,
        updatedAtIso: createdAtIso,
        createdMs,
        updatedMs: createdMs
      };
    });
  }

  private buildSeededRequests(
    ownerUserId: string,
    type: AppTypes.AssetType,
    users: readonly DemoUser[],
    seedOffset: number
  ): AppTypes.AssetMemberRequest[] {
    if (users.length === 0) {
      return [];
    }
    const targetCount = type === 'Car' ? 3 : 2;
    const prioritizedUsers = DemoUserSeedBuilder.friendUsersForActiveUser(users, ownerUserId, Math.max(targetCount * 3, targetCount));
    const requestUsers = prioritizedUsers.length > 0 ? prioritizedUsers : [...users];
    const requests: AppTypes.AssetMemberRequest[] = [];
    for (let index = 0; index < targetCount; index += 1) {
      const user = requestUsers[(seedOffset + (index * 3)) % requestUsers.length];
      const status = index === 0 ? 'pending' : 'accepted';
      requests.push({
        id: `${ownerUserId}:${type}:request:${index + 1}`,
        userId: user.id,
        name: user.name,
        initials: user.initials,
        gender: user.gender,
        status,
        note: status === 'pending'
          ? 'Awaiting owner confirmation.'
          : 'Approved and synced with the plan.'
      });
    }
    return requests;
  }

  private querySeedUsers(): DemoUser[] {
    return this.usersRepository.queryGameStackUsers() as DemoUser[];
  }

  private readOwnerAssets(ownerUserId: string): AppTypes.AssetCard[] {
    const table = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    return (table.idsByOwnerUserId[ownerUserId] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is DemoAssetRecord => Boolean(record))
      .sort((left, right) => right.updatedMs - left.updatedMs)
      .map(record => this.toAssetCard(record));
  }

  private toAssetCard(record: DemoAssetRecord): AppTypes.AssetCard {
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      subtitle: record.subtitle,
      city: record.city,
      capacityTotal: record.capacityTotal,
      details: record.details,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      routes: [...(record.routes ?? [])],
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      requests: record.requests.map(request => ({ ...request }))
    };
  }

  private normalizeCollection(value: unknown): DemoAssetsRecordCollection {
    const source = value as Partial<DemoAssetsRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, DemoAssetRecord>) }
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

  private upsertRecordCollection(
    table: DemoAssetsRecordCollection,
    record: DemoAssetRecord
  ): DemoAssetsRecordCollection {
    const nextById = { ...table.byId, [record.id]: { ...record, routes: [...(record.routes ?? [])], requests: record.requests.map(request => ({ ...request })) } };
    const nextIds = table.ids.includes(record.id) ? [...table.ids] : [record.id, ...table.ids];
    const nextIdsByOwnerUserId = { ...table.idsByOwnerUserId };
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

  private deleteRecordCollection(
    table: DemoAssetsRecordCollection,
    assetId: string
  ): DemoAssetsRecordCollection {
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
