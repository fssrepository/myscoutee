import { Injectable, inject } from '@angular/core';

import { AssetCardBuilder, PricingBuilder } from '../../../core/base/builders';
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
        topics: [...(normalizedAsset.topics ?? [])],
        policies: (normalizedAsset.policies ?? []).map(item => ({ ...item })),
        pricing: normalizedAsset.pricing ? PricingBuilder.clonePricingConfig(normalizedAsset.pricing) : undefined,
        requests: normalizedAsset.requests.map(request => this.cloneRequest(request))
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
      topics: [...(asset.topics ?? [])],
      policies: (asset.policies ?? []).map(item => ({ ...item })),
      pricing: asset.pricing ? PricingBuilder.clonePricingConfig(asset.pricing) : undefined,
      requests: asset.requests.map(request => this.cloneRequest(request))
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
        requests: this.buildSeededRequests(ownerUserId, card, otherUsers, index),
        createdAtIso,
        updatedAtIso: createdAtIso,
        createdMs,
        updatedMs: createdMs
      };
    });
  }

  private buildSeededRequests(
    ownerUserId: string,
    card: Pick<AppTypes.AssetCard, 'title' | 'type'>,
    users: readonly DemoUser[],
    seedOffset: number
  ): AppTypes.AssetMemberRequest[] {
    if (users.length === 0) {
      return [];
    }
    const targetCount = card.type === 'Car' ? 3 : 2;
    const prioritizedUsers = DemoUserSeedBuilder.friendUsersForActiveUser(users, ownerUserId, Math.max(targetCount * 3, targetCount));
    const requestUsers = prioritizedUsers.length > 0 ? prioritizedUsers : [...users];
    const requests: AppTypes.AssetMemberRequest[] = [];
    for (let index = 0; index < targetCount; index += 1) {
      const user = requestUsers[(seedOffset + (index * 3)) % requestUsers.length];
      const status = index === 0 ? 'pending' : 'accepted';
      const booking = this.buildSeededRequestBooking(card, index);
      requests.push({
        id: `${ownerUserId}:${card.type}:request:${index + 1}`,
        userId: user.id,
        name: user.name,
        initials: user.initials,
        gender: user.gender,
        status,
        note: status === 'pending'
          ? 'Awaiting owner confirmation.'
          : 'Approved and synced with the plan.',
        requestKind: 'borrow',
        requestedAtIso: booking.startAtIso
          ? new Date(new Date(booking.startAtIso).getTime() - ((index + 2) * 24 * 60 * 60 * 1000)).toISOString()
          : undefined,
        booking
      });
    }
    return requests;
  }

  private buildSeededRequestBooking(
    card: Pick<AppTypes.AssetCard, 'title' | 'type'>,
    index: number
  ): AppTypes.AssetHireRequestBooking {
    const slotsByTitle: Record<string, Array<{ eventTitle: string; subEventTitle: string; startAtIso: string; endAtIso: string }>> = {
      'Camping Gear Kit': [
        {
          eventTitle: 'Forest Basecamp Weekend',
          subEventTitle: 'Camp Setup',
          startAtIso: '2026-04-18T15:00:00.000Z',
          endAtIso: '2026-04-20T10:00:00.000Z'
        },
        {
          eventTitle: 'Forest Basecamp Weekend',
          subEventTitle: 'Night Watch',
          startAtIso: '2026-04-19T18:00:00.000Z',
          endAtIso: '2026-04-20T08:00:00.000Z'
        }
      ],
      'Game Night Box': [
        {
          eventTitle: 'Indoor Strategy Social',
          subEventTitle: 'Board Game Lounge',
          startAtIso: '2026-05-02T17:30:00.000Z',
          endAtIso: '2026-05-02T22:00:00.000Z'
        },
        {
          eventTitle: 'Indoor Strategy Social',
          subEventTitle: 'Late Table Finals',
          startAtIso: '2026-05-02T20:00:00.000Z',
          endAtIso: '2026-05-03T00:30:00.000Z'
        }
      ],
      'South Congress Loft': [
        {
          eventTitle: 'Austin Host Meetup',
          subEventTitle: 'Weekend Stay',
          startAtIso: '2026-06-12T14:00:00.000Z',
          endAtIso: '2026-06-14T11:00:00.000Z'
        },
        {
          eventTitle: 'Austin Host Meetup',
          subEventTitle: 'Overflow Rooms',
          startAtIso: '2026-06-13T17:00:00.000Z',
          endAtIso: '2026-06-14T10:00:00.000Z'
        }
      ],
      'Eastside Guest Room': [
        {
          eventTitle: 'Sunrise Photo Walk',
          subEventTitle: 'Overnight Stay',
          startAtIso: '2026-07-03T18:00:00.000Z',
          endAtIso: '2026-07-04T09:00:00.000Z'
        },
        {
          eventTitle: 'Sunrise Photo Walk',
          subEventTitle: 'Second Night',
          startAtIso: '2026-07-04T18:00:00.000Z',
          endAtIso: '2026-07-05T09:00:00.000Z'
        }
      ],
      'City-to-Lake SUV': [
        {
          eventTitle: 'Lake Cleanup Trip',
          subEventTitle: 'Departure Ride',
          startAtIso: '2026-05-09T07:30:00.000Z',
          endAtIso: '2026-05-09T10:30:00.000Z'
        },
        {
          eventTitle: 'Lake Cleanup Trip',
          subEventTitle: 'Return Ride',
          startAtIso: '2026-05-09T16:00:00.000Z',
          endAtIso: '2026-05-09T19:00:00.000Z'
        },
        {
          eventTitle: 'Trail Weekend',
          subEventTitle: 'Gear Shuttle',
          startAtIso: '2026-05-16T09:00:00.000Z',
          endAtIso: '2026-05-16T12:30:00.000Z'
        }
      ],
      'Airport Shuttle Hatchback': [
        {
          eventTitle: 'Late Arrival Crew',
          subEventTitle: 'Airport Pickup',
          startAtIso: '2026-08-21T21:30:00.000Z',
          endAtIso: '2026-08-21T23:45:00.000Z'
        },
        {
          eventTitle: 'Late Arrival Crew',
          subEventTitle: 'Hotel Dropoff',
          startAtIso: '2026-08-22T00:00:00.000Z',
          endAtIso: '2026-08-22T01:15:00.000Z'
        },
        {
          eventTitle: 'Night Market Run',
          subEventTitle: 'Pickup Loop',
          startAtIso: '2026-08-28T18:30:00.000Z',
          endAtIso: '2026-08-28T21:00:00.000Z'
        }
      ]
    };
    const slots = slotsByTitle[card.title] ?? [
      {
        eventTitle: `${card.title} Event`,
        subEventTitle: card.type === 'Supplies' ? 'Borrow Window' : 'Booking Window',
        startAtIso: '2026-04-18T15:00:00.000Z',
        endAtIso: '2026-04-18T18:00:00.000Z'
      }
    ];
    const slot = slots[index % slots.length];
    const slotKey = `${this.seededRequestSlug(card.title)}:${index + 1}`;
    return {
      eventId: `${this.seededRequestSlug(slot.eventTitle)}-event`,
      eventTitle: slot.eventTitle,
      subEventId: `${this.seededRequestSlug(slot.subEventTitle)}-subevent`,
      subEventTitle: slot.subEventTitle,
      slotKey,
      slotLabel: slot.subEventTitle,
      timeframe: this.formatSeededRequestTimeframe(slot.startAtIso, slot.endAtIso),
      startAtIso: slot.startAtIso,
      endAtIso: slot.endAtIso,
      quantity: 1
    };
  }

  private formatSeededRequestTimeframe(startAtIso: string, endAtIso: string): string {
    const start = new Date(startAtIso);
    const end = new Date(endAtIso);
    const sameDay = start.toDateString() === end.toDateString();
    const startDate = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return sameDay
      ? `${startDate} · ${startTime} - ${endTime}`
      : `${startDate} ${startTime} - ${endDate} ${endTime}`;
  }

  private seededRequestSlug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
      quantity: AssetCardBuilder.normalizeQuantity(record.type, record.quantity, record.capacityTotal),
      details: record.details,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      routes: [...(record.routes ?? [])],
      topics: [...(record.topics ?? [])],
      policies: (record.policies ?? []).map(item => ({ ...item })),
      pricing: record.pricing ? PricingBuilder.clonePricingConfig(record.pricing) : undefined,
      requests: record.requests.map(request => this.cloneRequest(request))
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
    const nextById = {
      ...table.byId,
      [record.id]: {
        ...record,
        routes: [...(record.routes ?? [])],
        requests: record.requests.map(request => this.cloneRequest(request))
      }
    };
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
