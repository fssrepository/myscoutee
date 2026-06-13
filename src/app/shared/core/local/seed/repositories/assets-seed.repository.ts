import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { AssetDefaultsBuilder, PricingBuilder } from '../../../base/builders';
import { LocalMemoryDb } from '../../../base/db';
import type { UserDto } from '../../../contracts/user.interface';
import type * as AppTypes from '../../../base/models';
import { ASSETS_TABLE_NAME, type AssetRecord, type AssetsRecordCollection } from '../../source/entity/asset.entity';
import { UserProfileStateBuilder } from '../../../base/builders';
import { SeedAssetBuilder, SeedScheduleBuilder } from '../builders';

import type * as AppDTOs from '../../../base/dto';
@Injectable({
  providedIn: 'root'
})
export class SeedAssetsRepository {
  private static readonly DEFAULT_ASSET_LIMIT_PER_OWNER = 12;

  private readonly memoryDb = inject(LocalMemoryDb);
  private lastSeedToken = '';

  seedDefaults(ownerUserIds?: readonly string[], seedUsers: readonly UserDto[] = []): Map<string, AppDTOs.AssetCardDTO[]> {
    const allUsers = seedUsers
      .filter(user => !UserProfileStateBuilder.isEmptyOnboardingProfileUserId(user.id))
      .filter(user => user.profileStatus === 'public');
    const normalizedOwnerIds = Array.from(new Set(
      (ownerUserIds ?? allUsers.map(user => user.id))
        .map(userId => `${userId ?? ''}`.trim())
        .filter(Boolean)
    ));
    if (normalizedOwnerIds.length === 0) {
      return new Map();
    }

    const currentTable = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const seedToken = `${currentTable.ids.length}:${normalizedOwnerIds.join('|')}`;
    if (this.lastSeedToken !== seedToken) {
      const nextTable = this.mergeSeededRecords(currentTable, normalizedOwnerIds, allUsers);
      if (nextTable.changed) {
        this.memoryDb.write(state => ({
          ...state,
          [ASSETS_TABLE_NAME]: nextTable.table
        }));
      }
      this.lastSeedToken = seedToken;
    }

    return this.peekOwnedAssetsByUsers(normalizedOwnerIds);
  }

  peekOwnedAssetsByUsers(userIds: readonly string[]): Map<string, AppDTOs.AssetCardDTO[]> {
    const table = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const assetsByUserId = new Map<string, AppDTOs.AssetCardDTO[]>();
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
    ownerUserIds: readonly string[],
    allUsers: readonly UserDto[]
  ): { table: AssetsRecordCollection; changed: boolean } {
    const sampleCards = SeedAssetBuilder.buildSampleAssetCards(allUsers)
      .slice(0, SeedAssetsRepository.DEFAULT_ASSET_LIMIT_PER_OWNER);
    const usersById = new Map(allUsers.map(user => [user.id, user]));
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    const nextIdSet = new Set(nextIds);
    const nextIdsByOwnerUserId = this.cloneOwnerUserIdIndex(currentTable.idsByOwnerUserId);
    let changed = false;

    for (const ownerUserId of ownerUserIds) {
      const owner = usersById.get(ownerUserId);
      if (!owner) {
        continue;
      }
      const ownerBucket = nextIdsByOwnerUserId[ownerUserId] ?? [];
      const ownerIdSet = new Set(ownerBucket);
      const createdAt = SeedScheduleBuilder.shiftDate(new Date('2026-02-01T12:00:00.000Z'));
      for (const [index, card] of sampleCards.entries()) {
        const id = `${ownerUserId}:${card.id}`;
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
          sourceLink: imageUrl,
          ownerUserId,
          ownerName: owner.name,
          visibility: index % 3 === 0 ? 'Friends only' : 'Public',
          status: index === 0 ? 'UR' : index === 1 ? 'D' : 'A',
          statusBeforeSuppression: index === 0 || index === 1 ? 'A' : null,
          pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
          policies: (card.policies ?? []).map(policy => ({ ...policy })),
          requests: (card.requests ?? []).map(request => ({ ...request })),
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
      table: {
        byId: nextById,
        ids: nextIds,
        idsByOwnerUserId: nextIdsByOwnerUserId
      },
      changed
    };
  }

  private toAssetCard(record: AssetRecord): AppDTOs.AssetCardDTO {
    return {
      ...record,
      routes: [...(record.routes ?? [])],
      topics: [...(record.topics ?? [])],
      policies: (record.policies ?? []).map(item => ({ ...item })),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      requests: (record.requests ?? []).map(request => ({ ...request })),
      menuActions: [...(record.menuActions ?? [])]
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
