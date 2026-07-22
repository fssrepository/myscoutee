import { describe, expect, it } from 'vitest';

import type { ActivityMemberDTO } from '../../core/contracts/activity.interface';
import { ActivityMemberImageCardConverter } from './activity-member-image-card.converter';

describe('ActivityMemberImageCardConverter', () => {
  it('labels a pending asset invitation as invitation pending', () => {
    const card = ActivityMemberImageCardConverter.convert(pendingInvitation(), {
      ownerType: 'asset'
    });

    expect(card.detail).toBe('Invitation Pending');
    expect(card.statusChip?.title).toBe('Invitation Pending');
  });
});

function pendingInvitation(): ActivityMemberDTO {
  return {
    id: 'asset-member-1',
    userId: 'user-1',
    name: 'Lucas Lane',
    initials: 'LL',
    gender: 'male',
    city: 'Seattle',
    statusText: 'Waiting for admin approval.',
    role: 'Member',
    status: 'pending',
    pendingSource: 'admin',
    requestKind: 'invite',
    invitedByActiveUser: true,
    metAtIso: '',
    actionAtIso: '2026-07-23T00:00:00Z',
    metWhere: 'City-to-Lake SUV',
    avatarUrl: ''
  };
}
