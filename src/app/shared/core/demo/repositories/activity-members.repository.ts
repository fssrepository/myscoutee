import { Injectable, inject } from '@angular/core';

import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesEventSyncPayload
} from '../../../core/base/models';
import { AppDemoGenerators } from '../../../app-demo-generators';
import type * as AppTypes from '../../../core/base/models';
import { AppUtils } from '../../../app-utils';
import { APP_DEMO_DATA, type DemoUser } from '../../../demo-data';
import { HttpActivityMembersRepository } from '../../http/repositories/activity-members.repository';
import type { DemoEventRecord } from '../models/events.model';
import { EVENTS_TABLE_NAME } from '../models/events.model';
import {
  ACTIVITY_MEMBERS_TABLE_NAME,
  type DemoActivityMemberRecord,
  type DemoActivityMembersRecordCollection
} from '../models/activity-members.model';
import { DemoEventsRepository } from './events.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoActivityMembersRepository extends HttpActivityMembersRepository {
  private readonly demoEventsRepository = inject(DemoEventsRepository);
  private lastInitToken = '';
  private demoActivityMemberUsersCache: DemoUser[] | null = null;
  private readonly ownerCapacityByKey = new Map<string, number>();

  constructor() {
    super();
  }

  init(): void {
    this.demoEventsRepository.init();
    const eventsTable = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const currentTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    const initToken = `${eventsTable.ids.length}:${currentTable.ids.length}:${Object.keys(currentTable.idsByOwnerKey).length}`;
    if (this.lastInitToken === initToken) {
      return;
    }

    const seededRecords = this.buildSeededEventOwnerRecords();
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    const nextIdsByOwnerKey = this.cloneOwnerKeyIndex(currentTable.idsByOwnerKey);
    const existingOwnerKeys = new Set(
      currentTable.ids
        .map(id => currentTable.byId[id]?.ownerKey ?? '')
        .filter(ownerKey => ownerKey.length > 0)
    );
    let changed = false;

    for (const record of seededRecords) {
      if (existingOwnerKeys.has(record.ownerKey)) {
        continue;
      }
      nextById[record.id] = { ...record };
      nextIds.push(record.id);
      const ownerBucket = nextIdsByOwnerKey[record.ownerKey] ?? [];
      ownerBucket.push(record.id);
      nextIdsByOwnerKey[record.ownerKey] = ownerBucket;
      changed = true;
    }

    if (changed) {
      this.memoryDb.write(state => ({
        ...state,
        [ACTIVITY_MEMBERS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds,
          idsByOwnerKey: nextIdsByOwnerKey
        }
      }));
    }

    this.syncEventSummariesFromMembers();
    const finalTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    this.lastInitToken = `${eventsTable.ids.length}:${finalTable.ids.length}:${Object.keys(finalTable.idsByOwnerKey).length}`;
  }

  override peekMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    this.init();
    return this.readMembersByOwner(owner);
  }

  override async queryMembersByOwner(owner: ActivityMemberOwnerRef): Promise<AppTypes.ActivityMemberEntry[]> {
    this.init();
    return this.readMembersByOwner(owner);
  }

  override peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    this.init();
    return this.readSummaryByOwner(owner);
  }

  override async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummary[]> {
    this.init();
    return this.normalizeOwners(owners)
      .map(owner => this.readSummaryByOwner(owner))
      .filter((summary): summary is ActivityMembersSummary => Boolean(summary));
  }

  override async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): Promise<void> {
    this.init();
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    const summary = this.writeOwnerMembers(normalizedOwner, members, capacityTotal, true);
    this.cacheMembers(normalizedOwner, members, summary.capacityTotal);
  }

  override async syncEventMembersFromEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    this.init();
    const eventId = payload.id.trim();
    if (!eventId) {
      return;
    }

    const owner: ActivityMemberOwnerRef = {
      ownerType: 'event',
      ownerId: eventId
    };
    const row = this.buildActivityRowFromPayload(payload);
    const creator = this.resolveDemoUser(
      payload.creatorUserId?.trim() || 'u1',
      payload.creatorName?.trim() || payload.title,
      payload.creatorInitials?.trim() || AppUtils.initialsFromText(payload.title),
      payload.creatorCity?.trim() || '',
      payload.creatorGender === 'woman' ? 'woman' : 'man'
    );
    const entryContext = this.buildEntryContext(row, creator);
    const acceptedTarget = this.normalizeMemberCount(payload.acceptedMembers)
      ?? this.normalizeMemberUserIds(payload.acceptedMemberUserIds).length;
    const pendingTarget = this.normalizeMemberCount(payload.pendingMembers)
      ?? this.normalizeMemberUserIds(payload.pendingMemberUserIds).length;
    const entries = this.buildEntriesFromUserIds(
      owner,
      entryContext,
      payload.acceptedMemberUserIds,
      payload.pendingMemberUserIds,
      acceptedTarget,
      pendingTarget
    );
    const summary = this.writeOwnerMembers(
      owner,
      entries,
      this.normalizeMemberCount(payload.capacityTotal)
        ?? this.normalizeMemberCount(payload.capacityMax)
        ?? Math.max(acceptedTarget, entries.filter(entry => entry.status === 'accepted').length),
      true
    );
    this.cacheMembers(owner, entries, summary.capacityTotal);
  }

  private readMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return [];
    }
    const ownerKey = this.ownerKey(normalizedOwner);
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    return (table.idsByOwnerKey[ownerKey] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is DemoActivityMemberRecord => Boolean(record))
      .map(record => this.toMemberEntry(record))
      .sort((left, right) => AppUtils.toSortableDate(left.actionAtIso) - AppUtils.toSortableDate(right.actionAtIso));
  }

  private get demoActivityMemberUsers(): DemoUser[] {
    if (!this.demoActivityMemberUsersCache) {
      this.demoActivityMemberUsersCache = AppDemoGenerators.buildExpandedDemoUsers(50);
    }
    return this.demoActivityMemberUsersCache;
  }

  private readSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return null;
    }
    const members = this.readMembersByOwner(normalizedOwner);
    const acceptedMembers = members.filter(member => member.status === 'accepted').length;
    const ownerKey = this.ownerKey(normalizedOwner);
    const storedCapacity = this.ownerCapacityByKey.get(ownerKey);
    const capacityTotal = normalizedOwner.ownerType === 'event'
      ? this.resolveEventCapacityTotal(normalizedOwner.ownerId, acceptedMembers)
      : Math.max(
          acceptedMembers,
          storedCapacity ?? this.parseSampleCapacityLabel(normalizedOwner.ownerId).capacityTotal ?? 0
        );
    return this.buildSummary(normalizedOwner, members, capacityTotal);
  }

  private writeOwnerMembers(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null,
    syncUserIds = true
  ): ActivityMembersSummary {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return this.buildSummary({ ownerType: 'event', ownerId: '' }, [], 0);
    }
    const ownerKey = this.ownerKey(normalizedOwner);
    const normalizedMembers = this.cloneEntries(members);
    const summary = this.buildSummary(
      normalizedOwner,
      normalizedMembers,
      capacityTotal ?? this.readSummaryByOwner(normalizedOwner)?.capacityTotal ?? null
    );

    this.memoryDb.write(state => {
      const table = this.normalizeCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);
      const nextById = { ...table.byId };
      const nextIds: string[] = [];
      const nextIdsByOwnerKey = this.cloneOwnerKeyIndex(table.idsByOwnerKey);
      const existingOwnerRecordsById: Record<string, DemoActivityMemberRecord> = {};

      for (const id of table.ids) {
        const current = table.byId[id];
        if (current?.ownerKey === ownerKey) {
          existingOwnerRecordsById[id] = current;
          delete nextById[id];
          continue;
        }
        nextIds.push(id);
      }

      delete nextIdsByOwnerKey[ownerKey];

      for (const member of normalizedMembers) {
        const record = this.toRecord(normalizedOwner, member, existingOwnerRecordsById[member.id]);
        nextById[record.id] = record;
        nextIds.push(record.id);
        const ownerBucket = nextIdsByOwnerKey[ownerKey] ?? [];
        ownerBucket.push(record.id);
        nextIdsByOwnerKey[ownerKey] = ownerBucket;
      }

      return {
        ...state,
        [ACTIVITY_MEMBERS_TABLE_NAME]: {
          byId: nextById,
          ids: nextIds,
          idsByOwnerKey: nextIdsByOwnerKey
        }
      };
    });

    this.ownerCapacityByKey.set(ownerKey, summary.capacityTotal);
    if (normalizedOwner.ownerType === 'event') {
      this.syncSingleEventSummary(normalizedOwner.ownerId, summary, syncUserIds);
    }

    return summary;
  }

  private syncEventSummariesFromMembers(): void {
    const table = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    const eventIds = Object.keys(table.idsByOwnerKey)
      .filter(ownerKey => ownerKey.startsWith('event:'))
      .map(ownerKey => ownerKey.slice('event:'.length))
      .filter(eventId => eventId.length > 0);

    for (const eventId of eventIds) {
      const summary = this.readSummaryByOwner({
        ownerType: 'event',
        ownerId: eventId
      });
      if (!summary) {
        continue;
      }
      this.syncSingleEventSummary(eventId, summary, false);
    }
  }

  private syncSingleEventSummary(eventId: string, summary: ActivityMembersSummary, syncUserIds: boolean): void {
    const normalizedEventId = eventId.trim();
    if (!normalizedEventId) {
      return;
    }
    this.memoryDb.write(state => {
      const table = state[EVENTS_TABLE_NAME];
      const nextById = { ...table.byId };
      let changed = false;

      for (const id of table.ids) {
        const current = table.byId[id];
        if (!current || current.id !== normalizedEventId) {
          continue;
        }
        nextById[id] = {
          ...current,
          acceptedMembers: summary.acceptedMembers,
          pendingMembers: summary.pendingMembers,
          capacityTotal: Math.max(summary.acceptedMembers, summary.capacityTotal),
          acceptedMemberUserIds: syncUserIds
            ? [...summary.acceptedMemberUserIds]
            : [...current.acceptedMemberUserIds],
          pendingMemberUserIds: syncUserIds
            ? [...summary.pendingMemberUserIds]
            : [...current.pendingMemberUserIds]
        };
        changed = true;
      }

      if (!changed) {
        return state;
      }

      return {
        ...state,
        [EVENTS_TABLE_NAME]: {
          byId: nextById,
          ids: [...table.ids]
        }
      };
    });
  }

  private buildSeededEventOwnerRecords(): DemoActivityMemberRecord[] {
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const preferredRecordByEventId = new Map<string, DemoEventRecord>();

    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record || record.isInvitation) {
        continue;
      }
      const current = preferredRecordByEventId.get(record.id);
      if (!current || this.shouldPreferRecord(record, current)) {
        preferredRecordByEventId.set(record.id, record);
      }
    }

    const records: DemoActivityMemberRecord[] = [];
    for (const eventRecord of preferredRecordByEventId.values()) {
      records.push(...this.buildSeededRecordsForEvent(eventRecord));
    }
    return records;
  }

  private normalizeCollection(
    table: DemoActivityMembersRecordCollection
  ): DemoActivityMembersRecordCollection {
    const nextById = { ...(table.byId ?? {}) };
    const nextIds = Array.isArray(table.ids) ? table.ids.map(id => String(id)) : [];
    const nextIdsByOwnerKey = this.cloneOwnerKeyIndex(table.idsByOwnerKey);

    for (const id of nextIds) {
      const record = nextById[id];
      const ownerKey = typeof record?.ownerKey === 'string' ? record.ownerKey.trim() : '';
      if (!ownerKey) {
        continue;
      }
      const ownerBucket = nextIdsByOwnerKey[ownerKey] ?? [];
      if (!ownerBucket.includes(id)) {
        ownerBucket.push(id);
      }
      nextIdsByOwnerKey[ownerKey] = ownerBucket;
    }

    return {
      byId: nextById,
      ids: nextIds,
      idsByOwnerKey: nextIdsByOwnerKey
    };
  }

  private cloneOwnerKeyIndex(index: Record<string, string[] | readonly string[] | undefined> | undefined): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerKey, ids] of Object.entries(index ?? {})) {
      if (!ownerKey.trim() || !Array.isArray(ids)) {
        continue;
      }
      next[ownerKey] = ids.map(id => String(id));
    }
    return next;
  }

  private shouldPreferRecord(next: DemoEventRecord, current: DemoEventRecord): boolean {
    if (next.type === 'hosting' && current.type !== 'hosting') {
      return true;
    }
    if (next.type !== 'hosting' && current.type === 'hosting') {
      return false;
    }
    if (next.isAdmin !== current.isAdmin) {
      return next.isAdmin;
    }
    return next.acceptedMembers >= current.acceptedMembers;
  }

  private buildSeededRecordsForEvent(record: DemoEventRecord): DemoActivityMemberRecord[] {
    const owner: ActivityMemberOwnerRef = {
      ownerType: 'event',
      ownerId: record.id
    };
    const creator = this.resolveDemoUser(
      record.creatorUserId,
      record.creatorName,
      record.creatorInitials,
      record.creatorCity,
      record.creatorGender
    );
    const row = this.buildActivityRowFromEventRecord(record);
    const entryContext = this.buildEntryContext(row, creator);
    const sampleCapacity = this.parseSampleCapacityLabel(record.id);
    const acceptedTarget = Math.max(
      this.normalizeMemberCount(record.acceptedMembers) ?? 0,
      sampleCapacity.acceptedMembers ?? 0
    );
    const pendingTarget = this.normalizeMemberCount(record.pendingMembers) ?? 0;
    const entries = this.buildEntriesFromUserIds(
      owner,
      entryContext,
      record.acceptedMemberUserIds,
      record.pendingMemberUserIds,
      acceptedTarget,
      pendingTarget
    );
    return entries.map(entry => this.toRecord(owner, entry));
  }

  private buildEntriesFromUserIds(
    owner: ActivityMemberOwnerRef,
    context: {
      row: AppTypes.ActivityListRow;
      rowKey: string;
      creator: DemoUser;
      generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
      generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    },
    acceptedMemberUserIds: readonly string[] | undefined,
    pendingMemberUserIds: readonly string[] | undefined,
    acceptedTarget: number,
    pendingTarget: number
  ): AppTypes.ActivityMemberEntry[] {
    const usedUserIds = new Set<string>();
    const acceptedEntries: AppTypes.ActivityMemberEntry[] = [];
    const pendingEntries: AppTypes.ActivityMemberEntry[] = [];

    for (const userId of this.normalizeMemberUserIds(acceptedMemberUserIds)) {
      const entry = this.buildEntryForUserId(context, userId, 'accepted');
      if (usedUserIds.has(entry.userId)) {
        continue;
      }
      acceptedEntries.push(entry);
      usedUserIds.add(entry.userId);
    }

    if (acceptedEntries.length < acceptedTarget) {
      const forcedEntries = AppDemoGenerators.buildForcedAcceptedMembers(
        context.row,
        context.rowKey,
        Math.max(acceptedTarget, 1),
        this.demoActivityMemberUsers,
        context.creator,
        APP_DEMO_DATA.activityMemberDefaults.forcedMetWhere
      );
      for (const entry of forcedEntries) {
        if (acceptedEntries.length >= acceptedTarget) {
          break;
        }
        if (usedUserIds.has(entry.userId)) {
          continue;
        }
        acceptedEntries.push({
          ...entry,
          role: entry.userId === context.creator.id ? 'Admin' : 'Member'
        });
        usedUserIds.add(entry.userId);
      }
    }

    for (const userId of this.normalizeMemberUserIds(pendingMemberUserIds)) {
      const entry = this.buildEntryForUserId(context, userId, 'pending');
      if (usedUserIds.has(entry.userId)) {
        continue;
      }
      pendingEntries.push(entry);
      usedUserIds.add(entry.userId);
    }

    if (pendingEntries.length < pendingTarget) {
      for (const entry of context.generatedPendingByUserId.values()) {
        if (pendingEntries.length >= pendingTarget) {
          break;
        }
        if (usedUserIds.has(entry.userId)) {
          continue;
        }
        pendingEntries.push({
          ...entry,
          role: entry.userId === context.creator.id ? 'Admin' : 'Member'
        });
        usedUserIds.add(entry.userId);
      }
    }

    if (pendingEntries.length < pendingTarget) {
      const fallbackCandidates = this.demoActivityMemberUsers.filter(user => !usedUserIds.has(user.id));
      for (const user of fallbackCandidates) {
        if (pendingEntries.length >= pendingTarget) {
          break;
        }
        const base = AppDemoGenerators.toActivityMemberEntry(
          user,
          context.row,
          context.rowKey,
          context.creator.id,
          {
            status: 'pending',
            pendingSource: 'admin',
            invitedByActiveUser: false
          },
          APP_DEMO_DATA.activityMemberMetPlaces
        );
        pendingEntries.push({
          ...base,
          role: user.id === context.creator.id ? 'Admin' : 'Member',
          requestKind: 'invite',
          statusText: 'Invitation pending.'
        });
        usedUserIds.add(user.id);
      }
    }

    return [...acceptedEntries, ...pendingEntries];
  }

  private buildEntryContext(row: AppTypes.ActivityListRow, creator: DemoUser): {
    row: AppTypes.ActivityListRow;
    rowKey: string;
    creator: DemoUser;
    generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
  } {
    const rowKey = `${row.type}:${row.id}`;
    const generated = AppDemoGenerators.generateActivityMembersForRow(
      row,
      rowKey,
      this.demoActivityMemberUsers,
      creator,
      APP_DEMO_DATA.activityMemberMetPlaces
    );
    return {
      row,
      rowKey,
      creator,
      generatedAcceptedByUserId: new Map(
        generated
          .filter(entry => entry.status === 'accepted')
          .map(entry => [entry.userId, { ...entry, role: entry.userId === creator.id ? 'Admin' : 'Member' }])
      ),
      generatedPendingByUserId: new Map(
        generated
          .filter(entry => entry.status === 'pending')
          .map(entry => [entry.userId, { ...entry, role: entry.userId === creator.id ? 'Admin' : 'Member' }])
      )
    };
  }

  private buildEntryForUserId(
    context: {
      row: AppTypes.ActivityListRow;
      rowKey: string;
      creator: DemoUser;
      generatedAcceptedByUserId: Map<string, AppTypes.ActivityMemberEntry>;
      generatedPendingByUserId: Map<string, AppTypes.ActivityMemberEntry>;
    },
    userId: string,
    status: AppTypes.ActivityMemberStatus
  ): AppTypes.ActivityMemberEntry {
    const generated = status === 'accepted'
      ? context.generatedAcceptedByUserId.get(userId)
      : context.generatedPendingByUserId.get(userId);
    if (generated) {
      return {
        ...generated,
        status,
        pendingSource: status === 'accepted' ? null : generated.pendingSource ?? 'admin',
        requestKind: status === 'accepted' ? null : generated.requestKind ?? 'invite',
        role: userId === context.creator.id ? 'Admin' : 'Member'
      };
    }

    const user = this.resolveDemoUser(userId);
    const base = AppDemoGenerators.toActivityMemberEntry(
      user,
      context.row,
      context.rowKey,
      context.creator.id,
      {
        status,
        pendingSource: status === 'accepted' ? null : 'admin',
        invitedByActiveUser: false
      },
      APP_DEMO_DATA.activityMemberMetPlaces
    );

    return {
      ...base,
      role: user.id === context.creator.id ? 'Admin' : 'Member',
      requestKind: status === 'accepted' ? null : 'invite',
      pendingSource: status === 'accepted' ? null : 'admin',
      statusText: status === 'accepted' ? base.statusText : 'Invitation pending.'
    };
  }

  private buildActivityRowFromEventRecord(record: DemoEventRecord): AppTypes.ActivityListRow {
    return {
      id: record.id,
      type: record.type === 'hosting' ? 'hosting' : 'events',
      title: record.title,
      subtitle: record.subtitle,
      detail: record.timeframe,
      dateIso: record.startAtIso,
      distanceKm: record.distanceKm,
      unread: record.activity,
      metricScore: record.relevance,
      isAdmin: true,
      source: {
        id: record.id,
        avatar: record.creatorInitials,
        title: record.title,
        shortDescription: record.subtitle,
        timeframe: record.timeframe,
        activity: record.activity,
        isAdmin: true,
        creatorUserId: record.creatorUserId,
        startAt: record.startAtIso,
        endAt: record.endAtIso,
        distanceKm: record.distanceKm,
        visibility: record.visibility,
        blindMode: record.blindMode,
        imageUrl: record.imageUrl,
        sourceLink: record.sourceLink,
        location: record.location,
        capacityMin: record.capacityMin,
        capacityMax: record.capacityMax,
        topics: [...record.topics],
        rating: record.rating,
        relevance: record.relevance,
        published: record.published
      } as AppTypes.ActivityListRow['source']
    };
  }

  private buildActivityRowFromPayload(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): AppTypes.ActivityListRow {
    return {
      id: payload.id,
      type: payload.target === 'hosting' ? 'hosting' : 'events',
      title: payload.title,
      subtitle: payload.shortDescription,
      detail: payload.timeframe,
      dateIso: payload.startAt,
      distanceKm: Math.max(0, Number(payload.distanceKm) || 0),
      unread: Math.max(0, Math.trunc(Number(payload.activity) || 0)),
      metricScore: Math.max(0, Math.trunc(Number(payload.activity) || 0)),
      isAdmin: true,
      source: {
        id: payload.id,
        avatar: payload.creatorInitials?.trim() || AppUtils.initialsFromText(payload.title),
        title: payload.title,
        shortDescription: payload.shortDescription,
        timeframe: payload.timeframe,
        activity: Math.max(0, Math.trunc(Number(payload.activity) || 0)),
        isAdmin: true,
        creatorUserId: payload.creatorUserId,
        startAt: payload.startAt,
        endAt: payload.endAt,
        distanceKm: payload.distanceKm,
        visibility: payload.visibility,
        blindMode: payload.blindMode,
        imageUrl: payload.imageUrl,
        sourceLink: payload.sourceLink,
        location: payload.location,
        capacityMin: payload.capacityMin,
        capacityMax: payload.capacityMax,
        topics: payload.topics ? [...payload.topics] : payload.topics,
        published: payload.published
      } as AppTypes.ActivityListRow['source']
    };
  }

  private resolveEventCapacityTotal(eventId: string, acceptedMembers: number): number {
    const table = this.memoryDb.read()[EVENTS_TABLE_NAME];
    const recordCapacity = table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoEventRecord => Boolean(record))
      .filter(record => record.id === eventId)
      .reduce((max, record) => Math.max(max, this.normalizeMemberCount(record.capacityTotal) ?? 0), 0);
    const sampleCapacity = this.parseSampleCapacityLabel(eventId).capacityTotal ?? 0;
    return Math.max(acceptedMembers, recordCapacity, sampleCapacity, 4);
  }

  private parseSampleCapacityLabel(eventId: string): { acceptedMembers: number | null; capacityTotal: number | null } {
    const source = APP_DEMO_DATA.activityCapacityById[eventId];
    if (!source) {
      return { acceptedMembers: null, capacityTotal: null };
    }
    const [acceptedPart, totalPart] = source.split('/').map(part => Number.parseInt(part.trim(), 10));
    return {
      acceptedMembers: Number.isFinite(acceptedPart) ? Math.max(0, acceptedPart) : null,
      capacityTotal: Number.isFinite(totalPart) ? Math.max(0, totalPart) : null
    };
  }

  private resolveDemoUser(
    userId: string,
    fallbackName = 'Unknown User',
    fallbackInitials = AppUtils.initialsFromText(fallbackName),
    fallbackCity = '',
    fallbackGender: DemoUser['gender'] = 'man'
  ): DemoUser {
    const normalizedUserId = userId.trim();
    const byId = this.demoActivityMemberUsers.find(user => user.id === normalizedUserId);
    if (byId) {
      return byId;
    }
    const templateSeed = AppDemoGenerators.hashText(`${normalizedUserId}:${fallbackName}`);
    const demoUsers = this.demoActivityMemberUsers;
    const template = demoUsers[templateSeed % demoUsers.length];
    return {
      ...(template ?? demoUsers[0]),
      id: normalizedUserId || template?.id || 'unknown-user',
      name: fallbackName || template?.name || 'Unknown User',
      initials: fallbackInitials || template?.initials || 'UN',
      city: fallbackCity || template?.city || '',
      gender: fallbackGender || template?.gender || 'man'
    };
  }

  private toRecord(
    owner: ActivityMemberOwnerRef,
    member: AppTypes.ActivityMemberEntry,
    existingRecord?: DemoActivityMemberRecord | null
  ): DemoActivityMemberRecord {
    const normalizedOwner = this.normalizeOwnerRef(owner)!;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    return {
      ...member,
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
      ownerKey: this.ownerKey(normalizedOwner),
      createdMs: Number.isFinite(Number(existingRecord?.createdMs)) ? Number(existingRecord?.createdMs) : nowMs,
      updatedMs: nowMs,
      createdAtIso: existingRecord?.createdAtIso?.trim() || nowIso,
      updatedAtIso: nowIso
    };
  }

  private toMemberEntry(record: DemoActivityMemberRecord): AppTypes.ActivityMemberEntry {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      initials: record.initials,
      gender: record.gender,
      city: record.city,
      statusText: record.statusText,
      role: record.role,
      status: record.status,
      pendingSource: record.pendingSource,
      requestKind: record.requestKind,
      invitedByActiveUser: record.invitedByActiveUser,
      metAtIso: record.metAtIso,
      actionAtIso: record.actionAtIso,
      metWhere: record.metWhere,
      relevance: record.relevance,
      avatarUrl: record.avatarUrl
    };
  }

  private normalizeMemberUserIds(userIds: readonly string[] | undefined): string[] {
    if (!Array.isArray(userIds)) {
      return [];
    }
    return Array.from(new Set(userIds
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
  }

  private normalizeMemberCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }
}
