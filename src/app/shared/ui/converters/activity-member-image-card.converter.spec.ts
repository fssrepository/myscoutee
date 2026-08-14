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

  it('shows checked-in attendance without replacing the accepted member role', () => {
    const member: ActivityMemberDTO = {
      ...pendingInvitation(),
      status: 'accepted',
      pendingSource: null,
      requestKind: null,
      attendanceStatus: 'checked-in',
      checkedInAtIso: '2026-08-13T12:34:56Z',
      checkedInByUserId: 'casey',
      checkedInTicketId: 'ticket-1'
    };

    const card = ActivityMemberImageCardConverter.convert(member, {
      ownerType: 'event',
      checkedInLabel: 'Beléptetve',
      formatCheckedInAt: value => `formatted:${value}`
    });

    expect(card.subtitle).toBe('Member · Seattle');
    expect(card.detail).toBe('Beléptetve · formatted:2026-08-13T12:34:56Z');
    expect(card.statusChip).toMatchObject({
      icon: 'how_to_reg',
      label: 'Beléptetve',
      palette: 'green',
      className: 'member-status-checked-in'
    });
  });
});

function pendingInvitation(): ActivityMemberDTO {
  return {
    id: 'asset-member-1',
    userId: 'user-1',
    name: 'Lucas Lane',
    initials: 'LL',
    gender: 'man',
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
