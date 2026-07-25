import { describe, expect, it } from 'vitest';

import type { ActivityMemberDTO } from '../../../contracts/activity.interface';
import { LocalActivityMembersBuilder } from './activity.mapper';

describe('LocalActivityMembersBuilder', () => {
  it('orders management queries by status group and newest action time', () => {
    const entries = [
      member('member-new', 'Member', 'accepted', '2026-07-23T11:00:00Z'),
      member('pending-old', 'Member', 'pending', '2026-07-23T08:00:00Z'),
      member('admin', 'Admin', 'accepted', '2026-07-23T07:00:00Z'),
      member('pending-new', 'Member', 'pending', '2026-07-23T09:00:00Z'),
      member('manager', 'Manager', 'accepted', '2026-07-23T10:00:00Z'),
      member('member-old', 'Member', 'accepted', '2026-07-23T06:00:00Z')
    ];

    expect(LocalActivityMembersBuilder.sortEntriesForManagement(entries).map(entry => entry.userId))
      .toEqual([
        'pending-new',
        'pending-old',
        'manager',
        'admin',
        'member-new',
        'member-old'
      ]);
  });
});

function member(
  userId: string,
  role: ActivityMemberDTO['role'],
  status: ActivityMemberDTO['status'],
  actionAtIso: string
): ActivityMemberDTO {
  return {
    id: userId,
    userId,
    name: userId,
    initials: userId.slice(0, 2),
    gender: 'man',
    city: '',
    statusText: '',
    role,
    status,
    pendingSource: status === 'pending' ? 'member' : null,
    requestKind: status === 'pending' ? 'join' : null,
    invitedByActiveUser: false,
    metAtIso: actionAtIso,
    actionAtIso,
    metWhere: '',
    avatarUrl: ''
  };
}
