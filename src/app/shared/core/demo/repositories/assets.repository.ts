import { Injectable, inject } from '@angular/core';

import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../core/base/builders';
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
  private static readonly VISIBLE_EXPLORE_OWNER_LIMIT = 12;
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly usersRepository = inject(DemoUsersRepository);

  init(ownerUserIds?: readonly string[]): void {
    const normalizedOwnerIds = Array.from(new Set(
      (ownerUserIds ?? this.querySeedUsers().map(user => user.id))
        .map(userId => userId.trim())
        .filter(userId => userId.length > 0)
    ));
    if (normalizedOwnerIds.length === 0) {
      return;
    }

    const ownerIdsToInitialize = normalizedOwnerIds;
    if (ownerIdsToInitialize.length === 0) {
      return;
    }

    let nextTable = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    let changed = false;

    for (const ownerUserId of ownerIdsToInitialize) {
      const records = this.buildSeededOwnerRecords(ownerUserId);
      if (records.length === 0) {
        continue;
      }
      const existingIds = new Set(nextTable.idsByOwnerUserId[ownerUserId] ?? []);
      for (const record of records) {
        if (existingIds.has(record.id)) {
          continue;
        }
        nextTable = this.upsertRecordCollection(nextTable, record);
        existingIds.add(record.id);
        changed = true;
      }
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

  override async queryVisibleAssets(query: AppTypes.AssetExploreQuery): Promise<AppTypes.AssetCard[]> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    this.init(this.querySeedUsers().map(user => user.id));
    const normalizedCategory = `${query.category ?? ''}`.trim();
    return this.readVisibleAssets(normalizedUserId)
      .filter(card => card.type === query.type)
      .filter(card => !normalizedCategory || card.category === normalizedCategory)
      .sort((left, right) => left.title.localeCompare(right.title));
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
        visibility: normalizedAsset.visibility ?? existing?.visibility ?? 'Public',
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
        visibility: asset.visibility ?? existing?.visibility ?? 'Public',
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
    const ownerIndex = Math.max(0, allUsers.findIndex(user => user.id === ownerUserId));
    const otherUsers = allUsers.filter(user => user.id !== ownerUserId);
    const baseCards = DemoAssetBuilder.buildSampleAssetCards(allUsers as DemoUser[]);
    const createdAt = new Date('2026-02-01T12:00:00.000Z');
    return baseCards.map((card, index) => {
      const createdMs = createdAt.getTime() + (index * 60_000);
      const createdAtIso = new Date(createdMs).toISOString();
      const imageUrl = DemoAssetBuilder.defaultAssetImage(card.type, `${ownerUserId}-${card.id}`);
      const category = this.seededCategoryForCard(card, ownerIndex, index);
      return {
        ...card,
        id: `${ownerUserId}:${card.id}`,
        category: AssetDefaultsBuilder.normalizeCategory(card.type, category),
        city: owner.city || card.city,
        subtitle: this.seededSubtitleForCard(card, ownerIndex, index),
        details: this.seededDetailsForCard(card, ownerIndex, index),
        imageUrl,
        sourceLink: imageUrl,
        pricing: this.seededPricingForCard(card, ownerIndex, index),
        policies: this.seededPoliciesForCard(card, ownerIndex, index),
        ownerUserId,
        ownerName: owner.name,
        visibility: this.seededVisibilityForCard(card, index),
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
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Camp Setup Hold',
          startAtIso: '2026-03-04T08:00:00.000Z',
          endAtIso: '2026-03-04T18:00:00.000Z'
        },
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Night Watch Hold',
          startAtIso: '2026-03-04T19:00:00.000Z',
          endAtIso: '2026-03-05T07:00:00.000Z'
        }
      ],
      'Game Night Box': [
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Game Lounge',
          startAtIso: '2026-03-04T17:30:00.000Z',
          endAtIso: '2026-03-04T22:00:00.000Z'
        },
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Late Table Finals',
          startAtIso: '2026-03-04T20:00:00.000Z',
          endAtIso: '2026-03-05T00:30:00.000Z'
        }
      ],
      'Field Kitchen Crate': [
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Catering Prep',
          startAtIso: '2026-03-04T06:30:00.000Z',
          endAtIso: '2026-03-04T12:00:00.000Z'
        },
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Dinner Service',
          startAtIso: '2026-03-04T17:00:00.000Z',
          endAtIso: '2026-03-04T21:00:00.000Z'
        }
      ],
      'PA Speaker Pack': [
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Main Stage Soundcheck',
          startAtIso: '2026-03-04T09:00:00.000Z',
          endAtIso: '2026-03-04T14:30:00.000Z'
        },
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Finals PA Reset',
          startAtIso: '2026-03-04T15:00:00.000Z',
          endAtIso: '2026-03-04T20:30:00.000Z'
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
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Finals Airport Pickup',
          startAtIso: '2026-03-04T07:30:00.000Z',
          endAtIso: '2026-03-04T10:00:00.000Z'
        },
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Finals Hotel Dropoff',
          startAtIso: '2026-03-04T11:15:00.000Z',
          endAtIso: '2026-03-04T13:00:00.000Z'
        },
        {
          eventTitle: 'Night Market Run',
          subEventTitle: 'Pickup Loop',
          startAtIso: '2026-08-28T18:30:00.000Z',
          endAtIso: '2026-08-28T21:00:00.000Z'
        }
      ],
      'Volunteer Crew Van': [
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Stage Crew Load-in',
          startAtIso: '2026-03-04T05:45:00.000Z',
          endAtIso: '2026-03-04T09:30:00.000Z'
        },
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Venue Supply Loop',
          startAtIso: '2026-03-04T12:30:00.000Z',
          endAtIso: '2026-03-04T16:00:00.000Z'
        },
        {
          eventTitle: 'Alpine Weekend 2.0',
          subEventTitle: 'Night Reset Pickup',
          startAtIso: '2026-03-04T18:30:00.000Z',
          endAtIso: '2026-03-04T21:00:00.000Z'
        }
      ],
      'Summit Transfer Sedan': [
        {
          eventTitle: 'Speaker Summit',
          subEventTitle: 'Green Room Pickup',
          startAtIso: '2026-03-05T08:00:00.000Z',
          endAtIso: '2026-03-05T10:30:00.000Z'
        },
        {
          eventTitle: 'Speaker Summit',
          subEventTitle: 'Hotel Return',
          startAtIso: '2026-03-05T17:00:00.000Z',
          endAtIso: '2026-03-05T18:30:00.000Z'
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

  private readVisibleAssets(activeUserId: string): AppTypes.AssetCard[] {
    const table = this.normalizeCollection(this.memoryDb.read()[ASSETS_TABLE_NAME]);
    const visibleOwnerIds = new Set(this.queryVisibleExploreOwners(activeUserId).map(user => user.id));
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoAssetRecord => Boolean(record))
      .filter(record => record.ownerUserId !== activeUserId)
      .filter(record => visibleOwnerIds.size === 0 || visibleOwnerIds.has(record.ownerUserId))
      .filter(record => record.visibility === 'Public'
        || (record.visibility === 'Friends only' && DemoUserSeedBuilder.isFriendOfActiveUser(record.ownerUserId, activeUserId)))
      .map(record => this.toAssetCard(record));
  }

  private toAssetCard(record: DemoAssetRecord): AppTypes.AssetCard {
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
      ownerUserId: record.ownerUserId,
      ownerName: record.ownerName,
      requests: record.requests.map(request => this.cloneRequest(request))
    };
  }

  private seededVisibilityForCard(card: Pick<AppTypes.AssetCard, 'type' | 'title'>, index: number): AppTypes.EventVisibility {
    if (card.type === 'Supplies') {
      return index % 2 === 0 ? 'Public' : 'Friends only';
    }
    if (card.type === 'Car') {
      return card.title.includes('Airport') ? 'Friends only' : 'Public';
    }
    return card.title.includes('Guest') ? 'Friends only' : 'Public';
  }

  private seededCategoryForCard(
    card: Pick<AppTypes.AssetCard, 'type' | 'category'>,
    ownerIndex: number,
    cardIndex: number
  ): AppTypes.AssetCategory {
    if (card.type !== 'Supplies') {
      return AssetDefaultsBuilder.normalizeCategory(card.type, card.category);
    }
    const supplyCategories = AssetDefaultsBuilder.assetCategoryOptions('Supplies');
    return supplyCategories[(ownerIndex + cardIndex) % supplyCategories.length] ?? 'Camping';
  }

  private seededSubtitleForCard(
    card: Pick<AppTypes.AssetCard, 'type' | 'subtitle'>,
    ownerIndex: number,
    cardIndex: number
  ): string {
    if (card.type === 'Car') {
      const variants = [
        'Volkswagen Golf · Manual',
        'Hyundai Tucson · Automatic',
        'Toyota Corolla · Hybrid',
        'Kia Sportage · Automatic'
      ];
      return variants[(ownerIndex + cardIndex) % variants.length] ?? card.subtitle;
    }
    if (card.type === 'Accommodation') {
      const variants = [
        'Private room · Shared bathroom',
        '2 bedrooms · 1 living room',
        'Studio loft · Self check-in',
        'Guest suite · Breakfast included'
      ];
      return variants[(ownerIndex + cardIndex) % variants.length] ?? card.subtitle;
    }
    const category = this.seededCategoryForCard(card, ownerIndex, cardIndex);
    const supplyVariants = [
      `${category} kit · Packed + labelled`,
      `${category} box · Ready for pickup`,
      `${category} bundle · Venue handoff`,
      `${category} set · Return inventory tracked`
    ];
    return supplyVariants[(ownerIndex + cardIndex) % supplyVariants.length] ?? card.subtitle;
  }

  private seededDetailsForCard(
    card: Pick<AppTypes.AssetCard, 'type' | 'details'>,
    ownerIndex: number,
    cardIndex: number
  ): string {
    if (card.type === 'Car') {
      const variants = [
        'Airport run before midnight, fuel split evenly.',
        'Pickup window is flexible, but luggage needs to stay compact.',
        'Driver prefers one stop only before the venue.',
        'Good for late arrivals and small gear loads.'
      ];
      return variants[(ownerIndex + cardIndex) % variants.length] ?? card.details;
    }
    if (card.type === 'Accommodation') {
      const variants = [
        'Check-in details are shared once the stay is confirmed.',
        'Quiet-hours friendly stay with simple self check-in.',
        'Best for short overnights tied to early sub-event starts.',
        'Host can coordinate late arrival if the schedule shifts.'
      ];
      return variants[(ownerIndex + cardIndex) % variants.length] ?? card.details;
    }
    const variants = [
      'Pickup only, inventory is counted at handoff.',
      'Owner can bring it to the venue if the timing lines up.',
      'Packed and labelled for fast sub-event handoff.',
      'Best for short borrow windows with tracked return.'
    ];
    return variants[(ownerIndex + cardIndex) % variants.length] ?? card.details;
  }

  private seededPricingForCard(
    card: Pick<AppTypes.AssetCard, 'type' | 'pricing'>,
    ownerIndex: number,
    cardIndex: number
  ): AppTypes.PricingConfig {
    const scenario = this.seededCheckoutScenarioForCard(card.type, ownerIndex, cardIndex);
    const modeByScenario: Record<string, AppTypes.PricingMode> = {
      free_open: 'fixed',
      free_policy: 'fixed',
      paid_simple: 'fixed',
      paid_policy: 'fixed',
      paid_time: 'time-based',
      paid_demand: 'demand-based'
    };
    const pricing = PricingBuilder.createSamplePricingConfig(modeByScenario[scenario] ?? 'fixed');
    pricing.chargeType = card.type === 'Supplies' ? 'per_attendee' : 'per_booking';
    pricing.basePrice = this.seededBasePriceForCardType(card.type, ownerIndex, cardIndex);
    pricing.minPrice = pricing.basePrice > 0 ? Math.max(0, pricing.basePrice - 8) : 0;
    pricing.maxPrice = pricing.basePrice > 0 ? pricing.basePrice + 24 : 28;
    pricing.rounding = card.type === 'Supplies' ? 'half' : 'whole';

    if (scenario === 'free_open' || scenario === 'free_policy') {
      pricing.enabled = false;
      pricing.basePrice = 0;
      pricing.minPrice = 0;
      pricing.maxPrice = 0;
      pricing.demandRulesEnabled = false;
      pricing.timeRulesEnabled = false;
      pricing.mode = 'fixed';
      return pricing;
    }

    if (scenario === 'paid_simple') {
      pricing.mode = 'fixed';
      pricing.demandRulesEnabled = false;
      pricing.timeRulesEnabled = false;
      return pricing;
    }

    if (scenario === 'paid_policy') {
      pricing.mode = 'fixed';
      pricing.basePrice += card.type === 'Accommodation' ? 8 : 4;
      pricing.minPrice = Math.max(0, pricing.basePrice - 6);
      pricing.maxPrice = pricing.basePrice + 12;
      pricing.demandRulesEnabled = false;
      pricing.timeRulesEnabled = false;
      return pricing;
    }

    if (scenario === 'paid_time') {
      pricing.mode = card.type === 'Supplies' ? 'time-based' : 'hybrid';
      pricing.timeRulesEnabled = true;
      pricing.timeRules = [
        {
          id: `time-window-${ownerIndex}-${cardIndex}-1`,
          trigger: 'specific_date',
          offsetValue: null,
          specificDateStart: '2026-03-04',
          specificDateEnd: '2026-03-05',
          action: {
            kind: card.type === 'Accommodation' ? 'increase_percent' : 'decrease_percent',
            value: card.type === 'Accommodation' ? 15 : 10
          },
          appliesTo: 'all_slots',
          slotIds: []
        }
      ];
      pricing.demandRulesEnabled = pricing.mode === 'hybrid';
      pricing.demandRules = pricing.mode === 'hybrid'
        ? [
            {
              id: `demand-window-${ownerIndex}-${cardIndex}-1`,
              operator: 'gte',
              capacityFilledPercent: 50,
              action: {
                kind: 'increase_percent',
                value: 10
              },
              appliesTo: 'all_slots',
              slotIds: []
            }
          ]
        : [];
      return pricing;
    }

    pricing.mode = 'demand-based';
    pricing.demandRulesEnabled = true;
    pricing.demandRules = [
      {
        id: `demand-window-${ownerIndex}-${cardIndex}-1`,
        operator: 'gte',
        capacityFilledPercent: 50,
        action: {
          kind: 'increase_percent',
          value: 12
        },
        appliesTo: 'all_slots',
        slotIds: []
      },
      {
        id: `demand-window-${ownerIndex}-${cardIndex}-2`,
        operator: 'gte',
        capacityFilledPercent: 80,
        action: {
          kind: 'increase_percent',
          value: 18
        },
        appliesTo: 'all_slots',
        slotIds: []
      }
    ];
    pricing.timeRulesEnabled = false;
    return pricing;
  }

  private seededBasePriceForCardType(type: AppTypes.AssetType, ownerIndex: number, cardIndex: number): number {
    const seed = ownerIndex + (cardIndex * 2);
    if (type === 'Car') {
      return 12 + ((seed % 6) * 4);
    }
    if (type === 'Accommodation') {
      return 20 + ((seed % 5) * 10);
    }
    return 4 + ((seed % 6) * 3);
  }

  private seededPoliciesForCard(
    card: Pick<AppTypes.AssetCard, 'type'>,
    ownerIndex: number,
    cardIndex: number
  ): AppTypes.EventPolicyItem[] {
    const policyPoolByType: Record<AppTypes.AssetType, Array<{ title: string; description: string; required: boolean }>> = {
      Car: [
        { title: 'Fuel reset', description: 'Return the car with the same fuel level.', required: true },
        { title: 'No smoking', description: 'Keep the cabin smoke-free during the borrow window.', required: true },
        { title: 'Confirm pickup', description: 'Message the owner 30 minutes before pickup.', required: false }
      ],
      Accommodation: [
        { title: 'Quiet hours', description: 'Respect quiet hours after 22:00.', required: true },
        { title: 'Shoes off', description: 'Leave shoes at the entrance.', required: false },
        { title: 'Checkout tidy', description: 'Leave the room in tidy condition before checkout.', required: true }
      ],
      Supplies: [
        { title: 'Count on return', description: 'Return all pieces and report missing items.', required: true },
        { title: 'Clean before return', description: 'Wipe down surfaces before handoff back.', required: false },
        { title: 'Protect packaging', description: 'Keep cases, cables, and labels together.', required: true }
      ]
    };
    const pool = policyPoolByType[card.type] ?? [];
    const scenario = this.seededCheckoutScenarioForCard(card.type, ownerIndex, cardIndex);
    const desiredCount = scenario === 'free_open'
      ? 0
      : scenario === 'paid_simple'
        ? Math.min(1, pool.length)
        : scenario === 'paid_time'
          ? Math.min(2, pool.length)
          : pool.length;
    return pool.slice(0, desiredCount).map((policy, index) => ({
      id: `${card.type.toLowerCase()}-policy-${ownerIndex}-${cardIndex}-${index + 1}`,
      title: policy.title,
      description: policy.description,
      required: policy.required
    }));
  }

  private seededCheckoutScenarioForCard(
    type: AppTypes.AssetType,
    ownerIndex: number,
    cardIndex: number
  ): 'free_open' | 'free_policy' | 'paid_simple' | 'paid_policy' | 'paid_time' | 'paid_demand' {
    const scenariosByType: Record<AppTypes.AssetType, ReadonlyArray<'free_open' | 'free_policy' | 'paid_simple' | 'paid_policy' | 'paid_time' | 'paid_demand'>> = {
      Car: ['free_policy', 'paid_simple', 'paid_policy', 'paid_time', 'paid_demand'],
      Accommodation: ['free_open', 'free_policy', 'paid_policy', 'paid_time', 'paid_demand'],
      Supplies: ['free_open', 'paid_simple', 'paid_policy', 'paid_time', 'paid_demand']
    };
    const scenarios = scenariosByType[type] ?? scenariosByType.Supplies;
    return scenarios[(ownerIndex + (cardIndex * 2)) % scenarios.length] ?? 'paid_simple';
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

  private queryVisibleExploreOwners(activeUserId: string): DemoUser[] {
    const allUsers = this.querySeedUsers();
    const prioritizedFriends = DemoUserSeedBuilder.friendUsersForActiveUser(
      allUsers,
      activeUserId,
      Math.min(8, DemoAssetsRepository.VISIBLE_EXPLORE_OWNER_LIMIT)
    );
    const prioritizedFriendIds = new Set(prioritizedFriends.map(user => user.id));
    const remainingUsers = allUsers
      .filter(user => user.id !== activeUserId)
      .filter(user => !prioritizedFriendIds.has(user.id))
      .sort((left, right) => left.id.localeCompare(right.id));
    return [
      ...prioritizedFriends,
      ...remainingUsers.slice(0, Math.max(0, DemoAssetsRepository.VISIBLE_EXPLORE_OWNER_LIMIT - prioritizedFriends.length))
    ];
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
