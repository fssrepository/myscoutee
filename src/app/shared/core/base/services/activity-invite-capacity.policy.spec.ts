import { describe, expect, it } from 'vitest';

import type { ActivityMemberDTO } from '../../contracts/activity.interface';
import { partitionEventInvitesByCapacity } from './activity-invite-capacity.policy';

const member = (
  userId: string,
  status: ActivityMemberDTO['status'],
  requestKind: ActivityMemberDTO['requestKind'] = null,
  pendingSource: ActivityMemberDTO['pendingSource'] = null
): ActivityMemberDTO => ({
  id: userId,
  userId,
  name: userId,
  initials: userId.slice(0, 2),
  gender: 'man',
  city: 'Austin',
  statusText: '',
  role: 'Member',
  status,
  pendingSource,
  requestKind,
  invitedByActiveUser: false,
  metAtIso: '',
  actionAtIso: '',
  metWhere: '',
  avatarUrl: ''
});

describe('partitionEventInvitesByCapacity', () => {
  it('treats a pending admin invitation as a reserved place', () => {
    const result = partitionEventInvitesByCapacity(
      [
        member('casey', 'accepted'),
        member('nova', 'accepted'),
        member('riley', 'pending', 'invite', 'admin')
      ],
      [member('anna', 'pending', 'invite', 'admin')],
      3
    );

    expect(result.acceptedAdditions).toEqual([]);
    expect(result.rejections).toEqual([{ userId: 'anna', reason: 'capacity-full' }]);
  });

  it('accepts only the additions that fit and reports the remainder', () => {
    const result = partitionEventInvitesByCapacity(
      [member('casey', 'accepted')],
      [
        member('nova', 'pending', 'invite', 'admin'),
        member('anna', 'pending', 'invite', 'admin')
      ],
      2
    );

    expect(result.acceptedAdditions.map(entry => entry.userId)).toEqual(['nova']);
    expect(result.rejections).toEqual([{ userId: 'anna', reason: 'capacity-full' }]);
  });
});
