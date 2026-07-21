import { EVENTS_TABLE_NAME } from '../../source/entity/event.entity';
import { CHATS_TABLE_NAME, type ChatThreadRecordCollection } from '../../source/entity/chat.entity';
import type { ActivityEventRecordCollection } from '../../source/entity/event.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../../../environments/environment';

import { AppUtils } from '../../../../app-utils';
import { LocalMemoryDb } from '../../../common/app.db';
import type { UserDto } from '../../../contracts/user.interface';
import type { UserRecord } from '../../source/entity/user.entity';
import { ACTIVITY_MEMBERS_TABLE_NAME, type ActivityMemberRecord, type ActivityMembersRecordCollection } from '../../source/entity/activity.entity';
import { ASSETS_TABLE_NAME, type AssetMemberRequestRecord, type AssetRecord } from '../../source/entity/asset.entity';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';
import { UserProfileState } from '../../../common/user-profile-state';

import { SeedEventBuilder, SeedEventsBuilder } from '../builders';
import { SEED_SCHEDULE_REFERENCE_DATE } from '../seed-constants';
import type { ActivityMemberOwnerRef } from '../../../contracts/activity.interface';
import type * as ActivityContracts from '../../../contracts/activity.interface';

import type * as AppConstants from '../../../common/constants';

type ActivityMemberSourceType = 'events' | 'hosting' | 'invitations';

interface ActivityMemberSourceModel {
  id: string;
  type: ActivityMemberSourceType;
  isAdmin?: boolean;
}

interface ExplicitSeedMemberUserIds {
  accepted: string[];
  pending: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SeedActivityMembersRepository {
  private static readonly MAX_BOOTSTRAP_RECORDS = 5000;
  private static readonly MAX_SEEDED_ASSETS_PER_USER = 2;
  private static readonly MAX_SEEDED_ASSET_REQUESTS_PER_OWNER = 1;
  private static readonly MEMBER_MET_PLACES = [
    'Coffee Social',
    'Workshop',
    'Gallery Evening',
    'Trail Weekend',
    'Game Night'
  ];

  private readonly memoryDb = inject(LocalMemoryDb);
  private lastSeedToken = '';

  seedDefaults(
    ownerUserIds?: readonly string[],
    assetsByUserId?: ReadonlyMap<string, readonly AssetRecord[]>,
    seedUsers: readonly UserRecord[] = []
  ): void {
    const state = this.memoryDb.read();
    const users = this.resolveSeedUsers(seedUsers);
    const normalizedOwnerUserIds = Array.from(new Set(
      (ownerUserIds ?? users.map(user => user.id))
        .map(userId => `${userId ?? ''}`.trim())
        .filter(userId => userId.length > 0)
    ));
    const eventsTable = state[EVENTS_TABLE_NAME];
    const currentTable = this.normalizeCollection(state[ACTIVITY_MEMBERS_TABLE_NAME]);
    const seedToken = [
      eventsTable.ids.length,
      currentTable.ids.length,
      Object.keys(currentTable.idsByOwnerKey).length,
      normalizedOwnerUserIds.join('|')
    ].join(':');

    if (this.lastSeedToken === seedToken) {
      return;
    }

    const usersById = new Map(users.map(user => [user.id, user] as const));
    const existingOwnerKeys = new Set(
      Object.entries(currentTable.idsByOwnerKey)
        .filter(([ownerKey, ids]) => ownerKey.length > 0 && ids.some(id => Boolean(currentTable.byId[id])))
        .map(([ownerKey]) => ownerKey)
    );
    const desiredOwners = new Map<string, ActivityMemberRecord[]>();
    const preferredEvents = this.computePreferredEventRecords(eventsTable);
    const explicitUserIdsByEventId = this.buildExplicitSeedMemberUserIdsByEventId();

    for (const eventRecord of preferredEvents) {
      this.setDesiredOwner(
        desiredOwners,
        this.buildSeededRecordsForEvent(eventRecord, users, usersById, explicitUserIdsByEventId)
      );
    }
    this.setDesiredOwner(desiredOwners, this.buildSeededHomeSocialBridgeRecords(usersById));
    this.setDesiredOwner(
      desiredOwners,
      this.buildSeededGroupChatMemberRecords(state[CHATS_TABLE_NAME], usersById)
    );
    for (const userId of normalizedOwnerUserIds) {
      this.setDesiredOwner(desiredOwners, this.buildSeededAssetOwnerRecordsForUser(
        userId,
        assetsByUserId?.get(userId) ?? this.readOwnedAssetsByUser(userId),
        users,
        usersById
      ));
    }

    const merge = this.mergeDesiredOwners(currentTable, desiredOwners, existingOwnerKeys);
    if (merge.changed) {
      this.memoryDb.write(currentState => {
        const syncedEvents = this.syncEventSummariesFromMembers(
          currentState[EVENTS_TABLE_NAME],
          merge.table
        );
        return {
          ...currentState,
          [ACTIVITY_MEMBERS_TABLE_NAME]: merge.table,
          [EVENTS_TABLE_NAME]: syncedEvents
        };
      });
    } else {
      const syncedEvents = this.syncEventSummariesFromMembers(eventsTable, currentTable);
      if (syncedEvents !== eventsTable) {
        this.memoryDb.write(currentState => ({
          ...currentState,
          [EVENTS_TABLE_NAME]: syncedEvents
        }));
      }
    }

    const finalTable = this.normalizeCollection(this.memoryDb.read()[ACTIVITY_MEMBERS_TABLE_NAME]);
    this.lastSeedToken = [
      eventsTable.ids.length,
      finalTable.ids.length,
      Object.keys(finalTable.idsByOwnerKey).length,
      normalizedOwnerUserIds.join('|')
    ].join(':');
  }

  private resolveSeedUsers(seedUsers: readonly UserRecord[]): UserDto[] {
    const source = seedUsers.length > 0
      ? seedUsers
      : this.memoryDb.read()[USERS_TABLE_NAME].ids
        .map(id => this.memoryDb.read()[USERS_TABLE_NAME].byId[id])
        .filter((user): user is UserDto => Boolean(user));
    return source
      .map(user => ({ ...user, images: [...(user.images ?? [])] }));
  }

  private setDesiredOwner(
    desiredOwners: Map<string, ActivityMemberRecord[]>,
    records: readonly ActivityMemberRecord[]
  ): void {
    for (const record of records) {
      const ownerKey = record.ownerKey.trim();
      if (!ownerKey) {
        continue;
      }
      const bucket = desiredOwners.get(ownerKey) ?? [];
      bucket.push(record);
      desiredOwners.set(ownerKey, bucket);
    }
  }

  private mergeDesiredOwners(
    currentTable: ActivityMembersRecordCollection,
    desiredOwners: ReadonlyMap<string, readonly ActivityMemberRecord[]>,
    existingOwnerKeys: ReadonlySet<string>
  ): { table: ActivityMembersRecordCollection; changed: boolean } {
    let nextById = { ...currentTable.byId };
    let nextIds = [...currentTable.ids];
    let nextIdsByOwnerKey = this.cloneOwnerKeyIndex(currentTable.idsByOwnerKey);
    let changed = false;

    for (const [ownerKey, records] of desiredOwners.entries()) {
      const shouldReplace = ownerKey.startsWith('event:') || ownerKey.startsWith('group:')
        ? this.ownerNeedsRefresh(currentTable, ownerKey, records)
        : !existingOwnerKeys.has(ownerKey);
      if (!shouldReplace) {
        continue;
      }
      if (
        !ownerKey.startsWith('event:')
        && nextIds.length + records.length > SeedActivityMembersRepository.MAX_BOOTSTRAP_RECORDS
      ) {
        continue;
      }

      nextById = { ...nextById };
      nextIds = nextIds.filter(id => {
        const existing = nextById[id];
        if (existing?.ownerKey !== ownerKey) {
          return true;
        }
        delete nextById[id];
        return false;
      });
      nextIdsByOwnerKey = this.cloneOwnerKeyIndex(nextIdsByOwnerKey);
      nextIdsByOwnerKey[ownerKey] = [];

      for (const record of records) {
        nextById[record.id] = this.cloneRecord(record);
        nextIds.push(record.id);
        nextIdsByOwnerKey[ownerKey].push(record.id);
      }
      changed = true;
    }

    return {
      table: {
        byId: nextById,
        ids: nextIds,
        idsByOwnerKey: nextIdsByOwnerKey
      },
      changed
    };
  }

  private ownerNeedsRefresh(
    currentTable: ActivityMembersRecordCollection,
    ownerKey: string,
    desiredRecords: readonly ActivityMemberRecord[]
  ): boolean {
    const currentRecords = (currentTable.idsByOwnerKey[ownerKey] ?? [])
      .map(id => currentTable.byId[id])
      .filter((record): record is ActivityMemberRecord => Boolean(record));
    if (currentRecords.length === 0) {
      return desiredRecords.length > 0;
    }
    return (
      currentRecords.filter(record => record.status === 'accepted').length
        !== desiredRecords.filter(record => record.status === 'accepted').length
      || currentRecords.filter(record => record.status === 'pending').length
        !== desiredRecords.filter(record => record.status === 'pending').length
      || !this.sameUserIds(
        currentRecords.map(record => record.userId),
        desiredRecords.map(record => record.userId)
      )
    );
  }

  private buildSeededRecordsForEvent(
    record: ActivityEventRecord,
    users: readonly UserDto[],
    usersById: ReadonlyMap<string, UserDto>,
    explicitUserIdsByEventId: ReadonlyMap<string, ExplicitSeedMemberUserIds>
  ): ActivityMemberRecord[] {
    const owner: ActivityMemberOwnerRef = { ownerType: 'event', ownerId: record.id };
    const creator = this.resolveDemoUser(
      record.creatorUserId,
      users,
      usersById,
      record.creatorName,
      record.creatorInitials,
      record.creatorCity,
      record.creatorGender
    );
    const row: ActivityMemberSourceModel = {
      id: record.id,
      type: 'events',
      isAdmin: true
    };
    const rowKey = `${row.type}:${row.id}`;
    const explicit = explicitUserIdsByEventId.get(record.id) ?? null;
    const userIds = this.seedMemberUserIdsForEventRecord(record, users, explicit);
    const adminIds = this.normalizeMemberUserIds([record.creatorUserId, ...(record.adminIds ?? [])]);
    const invitedUserIds = new Set(this.normalizeMemberUserIds(record.invitedMemberUserIds));
    const pendingRequestUserIds = new Set(this.normalizeMemberUserIds(record.pendingRequestMemberUserIds));
    const entries = [
      ...userIds.acceptedMemberUserIds.map(userId => this.toEntryForUserId(
        owner,
        row,
        rowKey,
        creator,
        userId,
        'accepted',
        users,
        usersById,
        { adminIds }
      )),
      ...userIds.pendingMemberUserIds.map(userId => this.toEntryForUserId(
        owner,
        row,
        rowKey,
        creator,
        userId,
        'pending',
        users,
        usersById,
        {
          adminIds,
          pendingSource: pendingRequestUserIds.has(userId) && !invitedUserIds.has(userId) ? 'member' : 'admin',
          requestKind: pendingRequestUserIds.has(userId) && !invitedUserIds.has(userId) ? 'join' : 'invite'
        }
      ))
    ];
    return entries.map(entry => this.toRecord(owner, entry));
  }

  private seedMemberUserIdsForEventRecord(
    record: ActivityEventRecord,
    users: readonly UserDto[],
    explicit: ExplicitSeedMemberUserIds | null
  ): {
    acceptedMemberUserIds: string[];
    pendingMemberUserIds: string[];
  } {
    const acceptedTarget = Math.max(0, this.normalizeMemberCount(record.acceptedMembers) ?? 0);
    const pendingTarget = Math.max(0, this.normalizeMemberCount(record.pendingMembers) ?? 0);
    const ownerUserId = record.userId.trim();
    const seedActiveUserId = record.creatorUserId || ownerUserId;
    const seededMemberUserIds = SeedEventBuilder.seededEventMemberIds(
      record.id,
      Math.max(acceptedTarget + pendingTarget, acceptedTarget, 1),
      users,
      seedActiveUserId
    );
    const usedUserIds = new Set<string>();
    const explicitAcceptedUserIds = explicit ? this.normalizeMemberUserIds(explicit.accepted) : [];
    const explicitPendingUserIds = explicit
      ? this.normalizeMemberUserIds(explicit.pending).filter(userId => !explicitAcceptedUserIds.includes(userId))
      : [];

    const recordAcceptedUserIds = this.normalizeMemberUserIds(record.acceptedMemberUserIds);
    const recordPendingUserIds = this.normalizeMemberUserIds(record.pendingMemberUserIds);

    const acceptedSource = recordAcceptedUserIds.length > 0
      ? recordAcceptedUserIds
      : explicit
      ? [
          ...(ownerUserId
            && !explicitPendingUserIds.includes(ownerUserId)
            && !explicitAcceptedUserIds.includes(ownerUserId)
              ? [ownerUserId]
              : []),
          ...explicitAcceptedUserIds
        ]
      : this.normalizeMemberUserIds(seededMemberUserIds)
          .filter(userId => userId !== ownerUserId);

    const pendingSource = recordPendingUserIds.length > 0
      ? recordPendingUserIds
      : explicit
      ? [
          ...explicitPendingUserIds
        ]
      : seededMemberUserIds;

    return {
      acceptedMemberUserIds: this.collectTargetMemberUserIds(
        acceptedSource,
        seededMemberUserIds,
        acceptedTarget,
        usedUserIds
      ),
      pendingMemberUserIds: this.collectTargetMemberUserIds(
        pendingSource,
        seededMemberUserIds,
        pendingTarget,
        usedUserIds
      )
    };
  }

  private toEntryForUserId(
    owner: ActivityMemberOwnerRef,
    row: ActivityMemberSourceModel,
    rowKey: string,
    creator: UserDto,
    userId: string,
    status: AppConstants.ActivityMemberStatus,
    users: readonly UserDto[],
    usersById: ReadonlyMap<string, UserDto>,
    options: {
      adminIds?: readonly string[];
      pendingSource?: AppConstants.ActivityPendingSource;
      requestKind?: AppConstants.ActivityMemberRequestKind;
    } = {}
  ): ActivityContracts.ActivityMemberDTO {
    void owner;
    const user = this.resolveDemoUser(userId, users, usersById);
    const isAdmin = this.normalizeMemberUserIds(options.adminIds).includes(user.id);
    const pendingSource = status === 'accepted' ? null : options.pendingSource ?? 'admin';
    const requestKind = status === 'accepted' ? null : options.requestKind ?? 'invite';
    const seed = AppUtils.hashText(`${rowKey}:${user.id}`);
    const metAt = AppUtils.addDays(new Date('2026-02-24T12:00:00'), -((seed % 220) + 1));
    const place = SeedActivityMembersRepository.MEMBER_MET_PLACES[
      seed % SeedActivityMembersRepository.MEMBER_MET_PLACES.length
    ] ?? 'Demo event';
    const base: ActivityContracts.ActivityMemberDTO = {
      id: `${rowKey}:${user.id}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      city: user.city,
      statusText: user.statusText,
      role: row.isAdmin && user.id === creator.id ? 'Admin' : 'Member',
      status,
      pendingSource,
      requestKind: status === 'pending' ? 'invite' : null,
      invitedByActiveUser: false,
      invitedByUserId: null,
      metAtIso: AppUtils.toIsoDateTime(metAt),
      actionAtIso: AppUtils.toIsoDateTime(metAt),
      metWhere: place,
      avatarUrl: AppUtils.firstImageUrl(user.images),
      profile: user
    };
    return {
      ...base,
      role: isAdmin ? 'Admin' : 'Member',
      requestKind,
      pendingSource,
      statusText: status === 'accepted'
        ? base.statusText
        : (requestKind === 'join' ? 'Waiting for organizer approval.' : 'Invitation pending.'),
      invitedByUserId: requestKind === 'invite' ? creator.id : null
    };
  }

  private buildSeededHomeSocialBridgeRecords(usersById: ReadonlyMap<string, UserDto>): ActivityMemberRecord[] {
    const seedGroups: Array<{ ownerId: string; metWhere: string; userIds: [string, string] }> = [
      { ownerId: 'demo-home-fic-u1-bridge', metWhere: 'Coffee Social Bridge', userIds: ['u1', 'u2'] },
      { ownerId: 'demo-home-fic-u1-candidate', metWhere: 'Coffee Social Bridge', userIds: ['u2', 'u42'] },
      { ownerId: 'demo-home-fic-u4-bridge', metWhere: 'Workshop Social Bridge', userIds: ['u4', 'u3'] },
      { ownerId: 'demo-home-fic-u4-candidate', metWhere: 'Workshop Social Bridge', userIds: ['u3', 'u43'] },
      { ownerId: 'demo-home-fic-u6-bridge', metWhere: 'Gallery Social Bridge', userIds: ['u6', 'u8'] },
      { ownerId: 'demo-home-fic-u6-candidate', metWhere: 'Gallery Social Bridge', userIds: ['u8', 'u46'] }
    ];
    const records: ActivityMemberRecord[] = [];
    for (const group of seedGroups) {
      const owner: ActivityMemberOwnerRef = { ownerType: 'group', ownerId: group.ownerId };
      for (const userId of group.userIds) {
        const user = this.resolveDemoUser(userId, [...usersById.values()], usersById);
        const metAtIso = AppUtils.rebaseDateTime(
          '2026-03-22T18:00:00.000Z',
          SEED_SCHEDULE_REFERENCE_DATE,
          environment.bootstrapOffsetInDays
        )
          ?? '2026-03-22T18:00:00.000Z';
        records.push(this.toRecord(owner, {
          id: `home-fic-seed:${group.ownerId}:${user.id}`.toLowerCase().replace(/[^a-z0-9:-]+/g, '-'),
          userId: user.id,
          name: user.name,
          initials: user.initials,
          gender: user.gender,
          city: user.city,
          statusText: 'Met at event.',
          role: 'Member',
          status: 'accepted',
          pendingSource: null,
          requestKind: null,
          invitedByActiveUser: false,
          invitedByUserId: null,
          metAtIso,
          actionAtIso: metAtIso,
          metWhere: group.metWhere,
          avatarUrl: user.images?.[0] ?? '',
          profile: user
        }));
      }
    }
    return records;
  }

  private buildSeededGroupChatMemberRecords(
    chats: ChatThreadRecordCollection,
    usersById: ReadonlyMap<string, UserDto>
  ): ActivityMemberRecord[] {
    const records: ActivityMemberRecord[] = [];
    const seen = new Set<string>();
    for (const id of chats.ids ?? []) {
      const chat = chats.byId[id];
      const ownerId = `${chat?.ownerId ?? ''}`.trim();
      if (!chat || chat.channelType !== 'groupSubEvent' || !ownerId) {
        continue;
      }
      for (const userId of chat.memberIds ?? []) {
        const normalizedUserId = `${userId ?? ''}`.trim();
        const key = `${ownerId}:${normalizedUserId}`;
        if (!normalizedUserId || seen.has(key)) {
          continue;
        }
        const user = usersById.get(normalizedUserId);
        if (!user) {
          continue;
        }
        seen.add(key);
        const actionAtIso = chat.dateIso || '2026-02-23T00:00:00.000Z';
        records.push(this.toRecord({ ownerType: 'group', ownerId }, {
          id: `group-chat-member:${ownerId}:${normalizedUserId}`,
          userId: normalizedUserId,
          name: user.name,
          initials: user.initials,
          gender: user.gender,
          city: user.city,
          statusText: user.statusText,
          role: 'Member',
          status: 'accepted',
          pendingSource: null,
          requestKind: null,
          invitedByActiveUser: false,
          invitedByUserId: null,
          metAtIso: actionAtIso,
          actionAtIso,
          metWhere: `${chat.title ?? 'Group channel'}`.split(' · ')[0],
          avatarUrl: AppUtils.firstImageUrl(user.images),
          profile: user
        }));
      }
    }
    return records;
  }

  private buildSeededAssetOwnerRecordsForUser(
    ownerUserId: string,
    assets: readonly AssetRecord[],
    users: readonly UserDto[],
    usersById: ReadonlyMap<string, UserDto>
  ): ActivityMemberRecord[] {
    return assets
      .slice(0, SeedActivityMembersRepository.MAX_SEEDED_ASSETS_PER_USER)
      .flatMap(asset => this.buildSeededEntriesForAsset(ownerUserId, asset, users, usersById)
        .map(entry => this.toRecord({ ownerType: 'asset', ownerId: asset.id }, entry)));
  }

  private buildSeededEntriesForAsset(
    ownerUserId: string,
    asset: AssetRecord,
    users: readonly UserDto[],
    usersById: ReadonlyMap<string, UserDto>
  ): ActivityContracts.ActivityMemberDTO[] {
    const seedBaseDate = AppUtils.shiftDate(
      new Date('2026-02-24T12:00:00.000Z'),
      SEED_SCHEDULE_REFERENCE_DATE,
      environment.bootstrapOffsetInDays
    );
    const owner = this.resolveDemoUser(ownerUserId, users, usersById, asset.ownerName?.trim() || 'Asset owner', '', asset.city);
    const ownerEntry: ActivityContracts.ActivityMemberDTO = {
      id: `${asset.id}:owner`,
      userId: owner.id,
      name: owner.name,
      initials: owner.initials,
      gender: owner.gender,
      city: owner.city || asset.city,
      statusText: 'Responsible manager for this asset.',
      role: 'Manager',
      status: 'accepted',
      pendingSource: null,
      requestKind: null,
      invitedByActiveUser: false,
      invitedByUserId: null,
      metAtIso: asset.updatedAtIso ?? seedBaseDate.toISOString(),
      actionAtIso: asset.updatedAtIso ?? seedBaseDate.toISOString(),
      metWhere: asset.title,
      avatarUrl: AppUtils.firstImageUrl(owner.images),
      profile: owner
    };
    const requests = asset.requests.length > 0
      ? [...asset.requests]
      : this.buildFallbackAssetRequests(ownerUserId, asset, users);
    const userList = [...users];
    const requestEntries = requests
      .slice(0, SeedActivityMembersRepository.MAX_SEEDED_ASSET_REQUESTS_PER_OWNER)
      .map((request, index): ActivityContracts.ActivityMemberDTO => {
        const requestUserId = AppUtils.resolveAssetRequestUserId(request, userList);
        const matchedUser = usersById.get(requestUserId)
          ?? AppUtils.findUserByName(userList, request.name)
          ?? this.resolveDemoUser(requestUserId, users, usersById, request.name, request.initials, asset.city, request.gender);
        const seed = AppUtils.hashText(`asset-members:${asset.id}:${request.id}:${matchedUser.id}:${index}`);
        const actionAtIso = AppUtils.toIsoDateTime(AppUtils.addDays(seedBaseDate, -((seed % 90) + 1)));
        const status: AppConstants.ActivityMemberStatus = request.status === 'pending' ? 'pending' : 'accepted';
        return {
          id: request.id?.trim() || `${asset.id}:member:${index + 1}`,
          userId: matchedUser.id,
          name: request.name,
          initials: request.initials,
          gender: request.gender,
          city: matchedUser.city || asset.city,
          statusText: request.note?.trim() || (status === 'pending' ? 'Waiting for owner confirmation.' : 'Accepted for this asset.'),
          role: status === 'accepted' && index === 1 ? 'Manager' : 'Member',
          status,
          pendingSource: status === 'pending' ? 'admin' : null,
          requestKind: status === 'pending' ? 'invite' : null,
          invitedByActiveUser: false,
          invitedByUserId: null,
          metAtIso: actionAtIso,
          actionAtIso,
          metWhere: asset.title,
          avatarUrl: AppUtils.firstImageUrl(matchedUser.images),
          profile: matchedUser
        };
      });
    return [ownerEntry, ...requestEntries];
  }

  private buildFallbackAssetRequests(
    ownerUserId: string,
    asset: AssetRecord,
    users: readonly UserDto[]
  ): AssetMemberRequestRecord[] {
    const requestUsers = UserProfileState.friendUsersForActiveUser(users, ownerUserId, 2);
    return requestUsers.map((user, index) => ({
      id: `${asset.id}:request:${index + 1}`,
      userId: user.id,
      name: user.name,
      initials: user.initials,
      gender: user.gender,
      status: index === 0 ? 'pending' : 'accepted',
      note: index === 0 ? 'Waiting for owner confirmation.' : 'Accepted for this asset.'
    }));
  }

  private syncEventSummariesFromMembers(
    eventsTable: ActivityEventRecordCollection,
    membersTable: ActivityMembersRecordCollection
  ): ActivityEventRecordCollection {
    const nextById = { ...eventsTable.byId };
    let changed = false;

    for (const id of eventsTable.ids) {
      const current = eventsTable.byId[id];
      if (!current) {
        continue;
      }
      const ownerKey = this.ownerKey({ ownerType: 'event', ownerId: current.id });
      const records = (membersTable.idsByOwnerKey[ownerKey] ?? [])
        .map(memberId => membersTable.byId[memberId])
        .filter((record): record is ActivityMemberRecord => Boolean(record));
      if (records.length === 0) {
        continue;
      }
      const acceptedMembers = records.filter(record => record.status === 'accepted').length;
      const pendingMembers = records.filter(record => record.status === 'pending').length;
      const acceptedMemberUserIds = this.normalizeMemberUserIds(records
        .filter(record => record.status === 'accepted')
        .map(record => record.userId));
      const pendingMemberUserIds = this.normalizeMemberUserIds(records
        .filter(record => record.status === 'pending')
        .map(record => record.userId));
      const invitedMemberUserIds = this.normalizeMemberUserIds(records
        .filter(record => record.status === 'pending' && (record.pendingSource === 'admin' || record.requestKind === 'invite'))
        .map(record => record.userId));
      const pendingRequestMemberUserIds = this.normalizeMemberUserIds(records
        .filter(record => record.status === 'pending' && (record.pendingSource === 'member' || record.requestKind === 'join'))
        .map(record => record.userId));
      const adminIds = this.normalizeMemberUserIds([
        current.creatorUserId,
        ...records
          .filter(record => record.status === 'accepted' && record.role === 'Admin')
          .map(record => record.userId)
      ]);
      const capacityTotal = Math.max(acceptedMembers, current.capacityTotal);
      if (
        current.acceptedMembers === acceptedMembers
        && current.pendingMembers === pendingMembers
        && current.capacityTotal === capacityTotal
        && this.sameUserIds(current.acceptedMemberUserIds, acceptedMemberUserIds)
        && this.sameUserIds(current.pendingMemberUserIds, pendingMemberUserIds)
        && this.sameUserIds(current.invitedMemberUserIds, invitedMemberUserIds)
        && this.sameUserIds(current.pendingRequestMemberUserIds, pendingRequestMemberUserIds)
        && this.sameUserIds(current.adminIds, adminIds)
      ) {
        continue;
      }
      nextById[id] = {
        ...current,
        acceptedMembers,
        pendingMembers,
        acceptedMemberUserIds,
        pendingMemberUserIds,
        invitedMemberUserIds,
        pendingRequestMemberUserIds,
        adminIds,
        capacityTotal
      };
      changed = true;
    }

    return changed
      ? { byId: nextById, ids: [...eventsTable.ids] }
      : eventsTable;
  }

  private computePreferredEventRecords(table: ActivityEventRecordCollection): ActivityEventRecord[] {
    const preferredRecordByEventId = new Map<string, ActivityEventRecord>();
    for (const id of table.ids) {
      const record = table.byId[id];
      if (!record) {
        continue;
      }
      const current = preferredRecordByEventId.get(record.id);
      if (!current || this.shouldPreferRecord(record, current)) {
        preferredRecordByEventId.set(record.id, record);
      }
    }
    return [...preferredRecordByEventId.values()];
  }

  private buildExplicitSeedMemberUserIdsByEventId(): Map<string, ExplicitSeedMemberUserIds> {
    const next = new Map<string, ExplicitSeedMemberUserIds>();
    const absorb = (item: {
      id?: string;
      acceptedMemberUserIds?: readonly string[];
      pendingMemberUserIds?: readonly string[];
    }): void => {
      const eventId = `${item.id ?? ''}`.trim();
      if (!eventId) {
        return;
      }
      const accepted = this.normalizeMemberUserIds(item.acceptedMemberUserIds);
      const pending = this.normalizeMemberUserIds(item.pendingMemberUserIds)
        .filter(userId => !accepted.includes(userId));
      if (accepted.length === 0 && pending.length === 0) {
        return;
      }
      const current = next.get(eventId) ?? { accepted: [], pending: [] };
      const mergedAccepted = this.normalizeMemberUserIds([...current.accepted, ...accepted]);
      const mergedPending = this.normalizeMemberUserIds([...current.pending, ...pending])
        .filter(userId => !mergedAccepted.includes(userId));
      next.set(eventId, {
        accepted: mergedAccepted,
        pending: mergedPending
      });
    };

    for (const items of Object.values(SeedEventsBuilder.buildSeedInvitationItemsByUser())) {
      for (const item of items) {
        absorb(item);
      }
    }
    for (const items of Object.values(SeedEventsBuilder.buildSeedEventItemsByUser())) {
      for (const item of items) {
        absorb(item);
      }
    }
    for (const items of Object.values(SeedEventsBuilder.buildSeedHostingItemsByUser())) {
      for (const item of items) {
        absorb(item);
      }
    }
    return next;
  }

  private collectTargetMemberUserIds(
    sourceUserIds: readonly string[],
    fallbackUserIds: readonly string[],
    target: number,
    usedUserIds: Set<string>
  ): string[] {
    const next: string[] = [];
    for (const userId of this.normalizeMemberUserIds([...sourceUserIds, ...fallbackUserIds])) {
      if (next.length >= target) {
        break;
      }
      if (usedUserIds.has(userId)) {
        continue;
      }
      next.push(userId);
      usedUserIds.add(userId);
    }
    return next;
  }

  private resolveDemoUser(
    userId: string,
    users: readonly UserDto[],
    usersById: ReadonlyMap<string, UserDto>,
    fallbackName = 'Unknown User',
    fallbackInitials = AppUtils.initialsFromText(fallbackName),
    fallbackCity = '',
    fallbackGender: UserDto['gender'] = 'man'
  ): UserDto {
    const normalizedUserId = userId.trim();
    const byId = usersById.get(normalizedUserId);
    if (byId) {
      return byId;
    }
    const templateSeed = AppUtils.hashText(`${normalizedUserId}:${fallbackName}`);
    const template = users[templateSeed % Math.max(1, users.length)];
    return {
      ...(template ?? {
        id: normalizedUserId || 'unknown-user',
        name: fallbackName,
        age: 30,
        birthday: '1996-01-01',
        city: fallbackCity,
        height: '170 cm',
        physique: '',
        languages: [],
        horoscope: '',
        initials: fallbackInitials || 'UN',
        gender: fallbackGender,
        statusText: 'Recently Active',
        hostTier: '',
        traitLabel: '',
        completion: 0,
        headline: '',
        about: '',
        profileStatus: 'public',
        activities: { game: 0, chats: 0, invitations: 0, events: 0, hosting: 0 }
      }),
      id: normalizedUserId || template?.id || 'unknown-user',
      name: fallbackName || template?.name || 'Unknown User',
      initials: fallbackInitials || template?.initials || 'UN',
      city: fallbackCity || template?.city || '',
      gender: fallbackGender || template?.gender || 'man'
    };
  }

  private readOwnedAssetsByUser(ownerUserId: string): AssetRecord[] {
    const table = this.memoryDb.read()[ASSETS_TABLE_NAME];
    return (table.idsByOwnerUserId[ownerUserId] ?? [])
      .map(id => table.byId[id])
      .filter((record): record is AssetRecord => Boolean(record))
      .filter(record => !this.isSuppressedAssetStatus(record.status));
  }

  private normalizeCollection(value: unknown): ActivityMembersRecordCollection {
    const source = value as Partial<ActivityMembersRecordCollection> | null | undefined;
    const byId = source?.byId && typeof source.byId === 'object'
      ? { ...(source.byId as Record<string, ActivityMemberRecord>) }
      : {};
    const ids = Array.isArray(source?.ids)
      ? source.ids.map(id => String(id)).filter(Boolean)
      : Object.keys(byId);
    const idsByOwnerKey = this.cloneOwnerKeyIndex(source?.idsByOwnerKey);
    for (const id of ids) {
      const ownerKey = `${byId[id]?.ownerKey ?? ''}`.trim();
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

  private cloneOwnerKeyIndex(index: Record<string, string[] | readonly string[] | undefined> | undefined): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [ownerKey, ids] of Object.entries(index ?? {})) {
      const normalizedOwnerKey = ownerKey.trim();
      if (!normalizedOwnerKey || !Array.isArray(ids)) {
        continue;
      }
      next[normalizedOwnerKey] = ids.map(id => String(id)).filter(Boolean);
    }
    return next;
  }

  private toRecord(owner: ActivityMemberOwnerRef, member: ActivityContracts.ActivityMemberDTO): ActivityMemberRecord {
    const ownerKey = this.ownerKey(owner);
    const createdMs = AppUtils.toSortableDate(member.actionAtIso) || Date.now();
    const createdAtIso = member.actionAtIso || new Date(createdMs).toISOString();
    const invitedByUserId = member.status === 'pending'
      && (member.requestKind === 'invite' || member.requestKind === 'waitlist-invite')
      ? member.invitedByUserId?.trim() || null
      : null;
    return {
      ...member,
      invitedByUserId,
      invitedByActiveUser: invitedByUserId ? member.invitedByActiveUser === true : false,
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      ownerKey,
      createdMs,
      updatedMs: createdMs,
      createdAtIso,
      updatedAtIso: createdAtIso
    };
  }

  private cloneRecord(record: ActivityMemberRecord): ActivityMemberRecord {
    return {
      ...record,
      profile: record.profile ? { ...record.profile, images: [...(record.profile.images ?? [])] } : record.profile
    };
  }

  private ownerKey(owner: ActivityMemberOwnerRef): string {
    return `${owner.ownerType}:${owner.ownerId}`;
  }

  private shouldPreferRecord(next: ActivityEventRecord, current: ActivityEventRecord): boolean {
    return next.acceptedMembers >= current.acceptedMembers;
  }

  private sameUserIds(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
    const leftIds = this.normalizeMemberUserIds(left);
    const rightIds = this.normalizeMemberUserIds(right);
    return leftIds.length === rightIds.length && leftIds.every((userId, index) => userId === rightIds[index]);
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

  private isSuppressedAssetStatus(status: string | null | undefined): boolean {
    const normalized = `${status ?? ''}`.trim();
    return normalized === 'UR' || normalized === 'B' || normalized === 'D' || normalized === 'I' || normalized === 'T';
  }
}
