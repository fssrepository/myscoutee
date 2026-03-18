import { Injectable, inject } from '@angular/core';

import type { EventExploreFeedFilters } from '../../../activities-models';
import { AppDemoGenerators } from '../../../app-demo-generators';
import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../app-types';
import type { ListQuery, PageResult } from '../../../ui';
import { AppContext } from '../context';
import type {
  UserDto,
  UserGameFilterPreferencesDto
} from '../interfaces';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { ActivityMembersService } from './activity-members.service';
import { EventsService } from './events.service';
import { GameService } from './game.service';

type EventExploreSortTuple = readonly [number, number, number, number];

interface PreparedEventExploreRecord {
  record: DemoEventRecord;
  sortTuple: EventExploreSortTuple;
}

interface EventExploreCursor {
  id: string;
  tuple: EventExploreSortTuple;
}

interface EventExploreProfileSignature {
  affinityScore: number;
  keywordTokens: string[];
  languageTokens: string[];
  traitTokens: string[];
  preferredGenders: Array<'woman' | 'man'>;
}

interface EventExploreRecordSignature {
  affinityScore: number;
  keywordTokens: string[];
  languageTokens: string[];
  traitTokens: string[];
  participantGenders: Array<'woman' | 'man'>;
}

@Injectable({
  providedIn: 'root'
})
export class EventExploreService {
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly appCtx = inject(AppContext);
  private readonly eventsService = inject(EventsService);
  private readonly gameService = inject(GameService);

  async loadPage(
    query: ListQuery<EventExploreFeedFilters>
  ): Promise<PageResult<DemoEventRecord>> {
    const filters = this.resolveFilters(query.filters);
    const records = await this.eventsService.queryExploreItems(filters.userId);
    return this.buildPageResult(records, filters, query.cursor, query.pageSize);
  }

  peekPage(filters: EventExploreFeedFilters): DemoEventRecord[] {
    const normalizedFilters = this.resolveFilters(filters);
    const records = this.eventsService.peekExploreItems(normalizedFilters.userId);
    return this.prepareRecords(records, normalizedFilters).map(item => this.cloneRecord(item.record));
  }

  private buildPageResult(
    records: readonly DemoEventRecord[],
    filters: EventExploreFeedFilters,
    cursorValue: string | null | undefined,
    pageSizeValue: number
  ): PageResult<DemoEventRecord> {
    const prepared = this.prepareRecords(records, filters);
    const total = prepared.length;
    const limit = this.resolvePageSize(pageSizeValue);
    const cursor = this.parseCursor(cursorValue);
    const remaining = cursor
      ? prepared.filter(item => this.comparePreparedWithCursor(item, cursor) > 0)
      : prepared;
    const pageItems = remaining.slice(0, limit);
    const items = pageItems
      .map(item => this.cloneRecord(item.record));
    const nextCursor = remaining.length > limit && pageItems.length > 0
      ? this.serializeCursor(pageItems[pageItems.length - 1])
      : null;

    return {
      items,
      total,
      nextCursor
    };
  }

  private prepareRecords(
    records: readonly DemoEventRecord[],
    filters: EventExploreFeedFilters
  ): PreparedEventExploreRecord[] {
    const usersById = this.buildUserDirectory(filters.userId);
    const profileSignature = this.buildProfileSignature(filters.userId, usersById);
    const selectedTopic = this.normalizeTopic(filters.topic);

    return records
      .map(record => this.withResolvedMemberSummary(record))
      .filter(record => !filters.friendsOnly || this.hasFriendGoing(record, filters.userId))
      .filter(record => !filters.openSpotsOnly || this.hasOpenSpots(record))
      .filter(record => !selectedTopic || record.topics.some(topic => this.normalizeTopic(topic) === selectedTopic))
      .map(record => {
        const sortTuple = this.buildSortTuple(
          record,
          filters,
          this.resolveMatchDistance(record, usersById, profileSignature)
        );
        return {
          record,
          sortTuple
        };
      })
      .sort((left, right) => this.comparePrepared(left, right));
  }

  private resolveFilters(
    input: Partial<EventExploreFeedFilters> | null | undefined
  ): EventExploreFeedFilters {
    return {
      userId: input?.userId?.trim() || this.appCtx.getActiveUserId().trim() || 'u1',
      order: this.normalizeOrder(input?.order),
      view: this.normalizeView(input?.view),
      friendsOnly: input?.friendsOnly === true,
      openSpotsOnly: input?.openSpotsOnly === true,
      topic: this.normalizeTopic(input?.topic ?? '')
    };
  }

  private normalizeOrder(value: unknown): AppTypes.EventExploreOrder {
    return value === 'past-events'
      || value === 'nearby'
      || value === 'most-relevant'
      || value === 'top-rated'
      ? value
      : 'upcoming';
  }

  private normalizeView(value: unknown): AppTypes.EventExploreView {
    return value === 'distance' ? 'distance' : 'day';
  }

  private resolvePageSize(value: number): number {
    if (!Number.isFinite(value)) {
      return 10;
    }
    return Math.max(1, Math.trunc(Number(value)));
  }

  private buildUserDirectory(userId: string): Map<string, UserDto> {
    const users = this.gameService.getGameCardsUsersSnapshot();
    const nextUsers = [...users];
    const activeProfile = this.appCtx.getUserProfile(userId) ?? this.appCtx.activeUserProfile();
    if (activeProfile && !nextUsers.some(user => user.id === activeProfile.id)) {
      nextUsers.push(activeProfile);
    }
    return new Map(nextUsers.map(user => [user.id, user]));
  }

  private withResolvedMemberSummary(record: DemoEventRecord): DemoEventRecord {
    const summary = this.activityMembersService.peekSummaryByOwnerId(record.id);
    if (!summary) {
      return this.cloneRecord(record);
    }
    return {
      ...this.cloneRecord(record),
      acceptedMembers: Math.max(0, Math.trunc(Number(summary.acceptedMembers) || 0)),
      pendingMembers: Math.max(0, Math.trunc(Number(summary.pendingMembers) || 0)),
      capacityTotal: Math.max(
        Math.max(0, Math.trunc(Number(summary.acceptedMembers) || 0)),
        Math.trunc(Number(summary.capacityTotal) || 0)
      ),
      acceptedMemberUserIds: [...summary.acceptedMemberUserIds],
      pendingMemberUserIds: [...summary.pendingMemberUserIds]
    };
  }

  private buildProfileSignature(
    userId: string,
    usersById: Map<string, UserDto>
  ): EventExploreProfileSignature {
    const profile = this.appCtx.getUserProfile(userId) ?? usersById.get(userId) ?? null;
    const preferences = this.appCtx.getUserFilterPreferences(userId);
    const keywordTokens = this.uniqueNormalizedTokens([
      ...(preferences?.interests ?? []),
      ...(preferences?.values ?? []),
      ...(preferences?.traitLabels ?? []),
      ...(profile?.languages ?? []),
      profile?.traitLabel ?? '',
      profile?.hostTier ?? ''
    ]);
    const languageTokens = this.uniqueNormalizedTokens(
      Array.isArray(preferences?.languages) && preferences.languages.length > 0
        ? preferences.languages
        : (profile?.languages ?? [])
    );
    const traitTokens = this.uniqueNormalizedTokens([
      ...(preferences?.traitLabels ?? []),
      profile?.traitLabel ?? '',
      profile?.hostTier ?? ''
    ]);
    const preferredGenders = Array.isArray(preferences?.genders)
      ? preferences.genders.filter(
        (gender): gender is 'woman' | 'man' => gender === 'woman' || gender === 'man'
      )
      : [];

    return {
      affinityScore: this.buildAffinityScore(
        keywordTokens,
        languageTokens,
        traitTokens,
        preferredGenders,
        profile,
        preferences
      ),
      keywordTokens,
      languageTokens,
      traitTokens,
      preferredGenders
    };
  }

  private buildRecordSignature(
    record: DemoEventRecord,
    usersById: Map<string, UserDto>
  ): EventExploreRecordSignature {
    const participantUsers = [
      usersById.get(record.creatorUserId),
      ...record.acceptedMemberUserIds.map(userId => usersById.get(userId) ?? null)
    ].filter((user): user is UserDto => Boolean(user));
    const keywordTokens = this.uniqueNormalizedTokens([
      ...record.topics,
      record.visibility,
      record.blindMode,
      ...participantUsers.flatMap(user => [...(user.languages ?? []), user.traitLabel ?? '', user.hostTier ?? ''])
    ]);
    const languageTokens = this.uniqueNormalizedTokens(
      participantUsers.flatMap(user => user.languages ?? [])
    );
    const traitTokens = this.uniqueNormalizedTokens(
      participantUsers.flatMap(user => [user.traitLabel ?? '', user.hostTier ?? ''])
    );
    const participantGenders = this.uniqueParticipantGenders(
      participantUsers.map(user => user.gender)
    );

    return {
      affinityScore: this.buildAffinityScore(
        keywordTokens,
        languageTokens,
        traitTokens,
        participantGenders,
        participantUsers[0] ?? null,
        null,
        record
      ),
      keywordTokens,
      languageTokens,
      traitTokens,
      participantGenders
    };
  }

  private buildAffinityScore(
    keywordTokens: readonly string[],
    languageTokens: readonly string[],
    traitTokens: readonly string[],
    genderTokens: readonly ('woman' | 'man')[],
    profile: UserDto | null,
    preferences: UserGameFilterPreferencesDto | null,
    record?: DemoEventRecord
  ): number {
    const ageValue = this.resolveAgeValue(profile, preferences, record);
    const heightValue = this.resolveHeightValue(profile, preferences, record);
    return (
      this.resolveTokenScore(keywordTokens, 'keyword') * 101
      + this.resolveTokenScore(languageTokens, 'language') * 83
      + this.resolveTokenScore(traitTokens, 'trait') * 89
      + this.resolveGenderScore(genderTokens) * 131
      + ageValue * 17
      + heightValue * 11
      + Math.round(AppUtils.clampNumber(record?.rating ?? 0, 0, 10) * 100) * 13
      + Math.max(0, Math.trunc(Number(record?.acceptedMembers) || 0)) * 19
    );
  }

  private resolveAgeValue(
    profile: UserDto | null,
    preferences: UserGameFilterPreferencesDto | null,
    record?: DemoEventRecord
  ): number {
    if (record) {
      return 18 + (AppDemoGenerators.hashText(`event-age:${record.id}:${record.creatorUserId}`) % 28);
    }
    const ageMin = Number.isFinite(preferences?.ageMin) ? Number(preferences?.ageMin) : null;
    const ageMax = Number.isFinite(preferences?.ageMax) ? Number(preferences?.ageMax) : null;
    if (ageMin !== null && ageMax !== null && ageMax >= ageMin) {
      return Math.round((ageMin + ageMax) / 2);
    }
    return Math.max(18, Math.trunc(Number(profile?.age) || 30));
  }

  private resolveHeightValue(
    profile: UserDto | null,
    preferences: UserGameFilterPreferencesDto | null,
    record?: DemoEventRecord
  ): number {
    if (record) {
      return 150 + (AppDemoGenerators.hashText(`event-height:${record.id}`) % 45);
    }
    const heightMin = Number.isFinite(preferences?.heightMinCm) ? Number(preferences?.heightMinCm) : null;
    const heightMax = Number.isFinite(preferences?.heightMaxCm) ? Number(preferences?.heightMaxCm) : null;
    if (heightMin !== null && heightMax !== null && heightMax >= heightMin) {
      return Math.round((heightMin + heightMax) / 2);
    }
    return this.parseHeightCm(profile?.height ?? '') ?? 170;
  }

  private resolveTokenScore(tokens: readonly string[], prefix: string): number {
    return tokens.reduce((total, token) => total + ((AppDemoGenerators.hashText(`${prefix}:${token}`) % 997) + 1), 0);
  }

  private resolveGenderScore(genders: readonly ('woman' | 'man')[]): number {
    return genders.reduce((total, gender) => total + (gender === 'woman' ? 37 : 53), 0);
  }

  private resolveMatchDistance(
    record: DemoEventRecord,
    usersById: Map<string, UserDto>,
    profileSignature: EventExploreProfileSignature
  ): number {
    const recordSignature = this.buildRecordSignature(record, usersById);
    let mismatchPenalty = 0;

    if (profileSignature.keywordTokens.length > 0 && !this.hasTokenIntersection(profileSignature.keywordTokens, recordSignature.keywordTokens)) {
      mismatchPenalty += 2;
    }
    if (profileSignature.languageTokens.length > 0 && !this.hasTokenIntersection(profileSignature.languageTokens, recordSignature.languageTokens)) {
      mismatchPenalty += 1;
    }
    if (profileSignature.traitTokens.length > 0 && !this.hasTokenIntersection(profileSignature.traitTokens, recordSignature.traitTokens)) {
      mismatchPenalty += 1;
    }
    if (profileSignature.preferredGenders.length > 0 && !this.hasGenderIntersection(profileSignature.preferredGenders, recordSignature.participantGenders)) {
      mismatchPenalty += 1;
    }

    const affinityGap = Math.abs(profileSignature.affinityScore - recordSignature.affinityScore);
    return mismatchPenalty * 1_000_000 + affinityGap;
  }

  private buildSortTuple(
    record: DemoEventRecord,
    filters: EventExploreFeedFilters,
    matchDistance: number
  ): EventExploreSortTuple {
    const startAtMs = this.startAtMs(record);
    const dayKey = this.dayKeyMs(record);
    const distanceMeters = this.distanceMeters(record);
    const ratingValue = -Math.round(AppUtils.clampNumber(record.rating, 0, 10) * 100);
    const isPast = startAtMs < Date.now() ? 1 : 0;
    const isFuture = isPast === 1 ? 1 : 0;

    if (filters.view === 'distance') {
      if (filters.order === 'past-events') {
        return [distanceMeters, isFuture, -startAtMs, matchDistance];
      }
      if (filters.order === 'nearby') {
        return [distanceMeters, isPast, startAtMs, matchDistance];
      }
      if (filters.order === 'top-rated') {
        return [distanceMeters, isPast, ratingValue, startAtMs];
      }
      if (filters.order === 'most-relevant') {
        return [distanceMeters, isPast, matchDistance, startAtMs];
      }
      return [distanceMeters, isPast, startAtMs, matchDistance];
    }

    if (filters.order === 'past-events') {
      return [isFuture, -dayKey, -startAtMs, distanceMeters];
    }
    if (filters.order === 'nearby') {
      return [isPast, dayKey, distanceMeters, startAtMs];
    }
    if (filters.order === 'top-rated') {
      return [isPast, dayKey, ratingValue, startAtMs];
    }
    if (filters.order === 'most-relevant') {
      return [isPast, dayKey, matchDistance, startAtMs];
    }
    return [isPast, dayKey, startAtMs, distanceMeters];
  }

  private comparePrepared(left: PreparedEventExploreRecord, right: PreparedEventExploreRecord): number {
    return this.compareSortTuple(left.sortTuple, right.sortTuple)
      || left.record.id.localeCompare(right.record.id);
  }

  private comparePreparedWithCursor(item: PreparedEventExploreRecord, cursor: EventExploreCursor): number {
    return this.compareSortTuple(item.sortTuple, cursor.tuple)
      || item.record.id.localeCompare(cursor.id);
  }

  private compareSortTuple(left: EventExploreSortTuple, right: EventExploreSortTuple): number {
    for (let index = 0; index < left.length; index += 1) {
      const delta = left[index] - right[index];
      if (delta !== 0) {
        return delta;
      }
    }
    return 0;
  }

  private parseCursor(value: string | null | undefined): EventExploreCursor | null {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalized) as { id?: unknown; tuple?: unknown };
      if (typeof parsed.id !== 'string' || !Array.isArray(parsed.tuple) || parsed.tuple.length !== 4) {
        return null;
      }
      const tuple = parsed.tuple.map(item => Number(item));
      if (tuple.some(item => !Number.isFinite(item))) {
        return null;
      }
      const normalizedTuple: EventExploreSortTuple = [
        tuple[0] ?? 0,
        tuple[1] ?? 0,
        tuple[2] ?? 0,
        tuple[3] ?? 0
      ];
      return {
        id: parsed.id,
        tuple: normalizedTuple
      };
    } catch {
      return null;
    }
  }

  private serializeCursor(item: PreparedEventExploreRecord | null): string | null {
    if (!item) {
      return null;
    }
    const cursor: EventExploreCursor = {
      id: item.record.id,
      tuple: item.sortTuple
    };
    return JSON.stringify({
      id: cursor.id,
      tuple: [...cursor.tuple]
    });
  }

  private hasFriendGoing(record: DemoEventRecord, userId: string): boolean {
    return record.acceptedMemberUserIds.some(memberUserId =>
      memberUserId !== userId && AppDemoGenerators.isFriendOfActiveUser(memberUserId, userId)
    );
  }

  private hasOpenSpots(record: DemoEventRecord): boolean {
    return record.capacityTotal > record.acceptedMembers;
  }

  private distanceMeters(record: DemoEventRecord): number {
    return Math.max(0, Math.round((Number(record.distanceKm) || 0) * 1000));
  }

  private startAtMs(record: DemoEventRecord): number {
    const parsed = new Date(record.startAtIso).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private dayKeyMs(record: DemoEventRecord): number {
    const parsed = new Date(record.startAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return 0;
    }
    return AppUtils.dateOnly(parsed).getTime();
  }

  private parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  private hasTokenIntersection(left: readonly string[], right: readonly string[]): boolean {
    const rightSet = new Set(right);
    return left.some(token => rightSet.has(token));
  }

  private hasGenderIntersection(
    left: readonly ('woman' | 'man')[],
    right: readonly ('woman' | 'man')[]
  ): boolean {
    const rightSet = new Set(right);
    return left.some(gender => rightSet.has(gender));
  }

  private uniqueParticipantGenders(values: ReadonlyArray<'woman' | 'man' | undefined>): Array<'woman' | 'man'> {
    const seen = new Set<'woman' | 'man'>();
    for (const value of values) {
      if (value === 'woman' || value === 'man') {
        seen.add(value);
      }
    }
    return [...seen];
  }

  private uniqueNormalizedTokens(values: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = this.normalizeTopic(value);
      if (normalized) {
        seen.add(normalized);
      }
    }
    return [...seen];
  }

  private normalizeTopic(value: string | null | undefined): string {
    return AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
  }

  private cloneRecord(record: DemoEventRecord): DemoEventRecord {
    return {
      ...record,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      topics: [...record.topics]
    };
  }
}
