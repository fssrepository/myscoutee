import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { COMMUNITY_GROUPS_TABLE_NAME } from '../../source/entity/community-group.entity';
import { ACTIVITY_MEMBERS_TABLE_NAME } from '../../source/entity/activity.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../../source/entity/user.entity';
import { SeedCommunityGroupsBuilder } from '../builders/community-groups-seed.builder';

@Injectable({ providedIn: 'root' })
export class SeedCommunityGroupsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  seedDefaults(users: readonly UserRecord[]): boolean {
    const state = this.memoryDb.read();
    const seed = SeedCommunityGroupsBuilder.build(users);
    // A group is seeded as one graph. Reopening the demo must preserve edited
    // groups and members who have since left, declined or changed role.
    const missing = seed.groups.filter(group => !state[COMMUNITY_GROUPS_TABLE_NAME].byId[group.id]);
    if (missing.length === 0) return false;
    const missingIds = new Set(missing.map(group => group.id));
    const members = seed.members.filter(member => missingIds.has(member.ownerId));
    const profiles = seed.profiles.filter(profile => missingIds.has(profile.workspaceGroupId!));
    this.memoryDb.write(current => {
      const groupsTable = current[COMMUNITY_GROUPS_TABLE_NAME];
      const membersTable = current[ACTIVITY_MEMBERS_TABLE_NAME];
      const usersTable = current[USERS_TABLE_NAME];
      const idsByOwnerKey = { ...membersTable.idsByOwnerKey };
      for (const member of members) {
        idsByOwnerKey[member.ownerKey] = [...(idsByOwnerKey[member.ownerKey] ?? []), member.id];
      }
      return { ...current,
        [COMMUNITY_GROUPS_TABLE_NAME]: {
          byId: { ...groupsTable.byId, ...Object.fromEntries(missing.map(group => [group.id, group])) },
          ids: [...groupsTable.ids, ...missingIds]
        },
        [ACTIVITY_MEMBERS_TABLE_NAME]: {
          byId: { ...membersTable.byId, ...Object.fromEntries(members.map(member => [member.id, member])) },
          ids: [...new Set([...membersTable.ids, ...members.map(member => member.id)])], idsByOwnerKey
        },
        [USERS_TABLE_NAME]: {
          byId: { ...usersTable.byId, ...Object.fromEntries(profiles.filter(profile => !usersTable.byId[profile.id]).map(profile => [profile.id, profile])) },
          ids: [...new Set([...usersTable.ids, ...profiles.map(profile => profile.id)])]
        }
      };
    });
    return true;
  }
}
