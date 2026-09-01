import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import type { ActivityMemberDTO } from '../../contracts/activity.interface';
import { HttpActivityInviteCandidatesService } from '../../http/services/activity-invite-candidates.service';
import { LocalActivityInviteCandidatesService } from '../../local/source/services/activity-invite-candidates.service';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { ActivityInviteCandidatesService } from './activity-invite-candidates.service';
import { ActivityMembersService } from './activity-members.service';
import { EventsService } from './events.service';
import { SessionService } from './session.service';

const member = (userId: string, status: ActivityMemberDTO['status']): ActivityMemberDTO => ({
  id: userId,
  userId,
  name: userId,
  initials: userId.slice(0, 2),
  gender: 'man',
  city: 'Austin',
  statusText: '',
  role: userId === 'manager' ? 'Manager' : 'Member',
  status,
  pendingSource: null,
  requestKind: null,
  invitedByActiveUser: false,
  metAtIso: '',
  actionAtIso: '',
  metWhere: '',
  avatarUrl: ''
});

describe('ActivityInviteCandidatesService', () => {
  const originalActivitiesDataSource = environment.activitiesDataSource;
  const replaceMembersByOwner = vi.fn();
  const manager = member('manager', 'accepted');

  beforeEach(() => {
    environment.activitiesDataSource = 'http';
    replaceMembersByOwner.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        ActivityInviteCandidatesService,
        {
          provide: SessionService,
          useValue: { currentSession: () => null }
        },
        {
          provide: UserProfileStore,
          useValue: { getActiveUserId: () => 'manager' }
        },
        {
          provide: ActivityMembersService,
          useValue: {
            peekMembersByOwner: () => [manager],
            peekSummaryByOwner: () => ({ capacityTotal: 4 }),
            replaceMembersByOwner
          }
        },
        {
          provide: EventsService,
          useValue: {}
        },
        {
          provide: LocalActivityInviteCandidatesService,
          useValue: {}
        },
        {
          provide: HttpActivityInviteCandidatesService,
          useValue: {}
        }
      ]
    });
  });

  afterEach(() => {
    environment.activitiesDataSource = originalActivitiesDataSource;
    TestBed.resetTestingModule();
  });

  it('keeps the runtime Event and Sub Event scope when inviting an assigned Asset member', async () => {
    const candidate = member('invitee', 'accepted');

    const result = await TestBed.inject(ActivityInviteCandidatesService).applyInvites(
      'asset-1',
      [candidate],
      'asset',
      {
        eventId: 'event-1',
        subEventId: 'main-event:event-1'
      }
    );

    expect(replaceMembersByOwner).toHaveBeenCalledWith(
      { ownerType: 'asset', ownerId: 'asset-1' },
      [
        manager,
        expect.objectContaining({
          userId: 'invitee',
          status: 'pending',
          pendingSource: 'admin',
          requestKind: 'invite'
        })
      ],
      4,
      {
        eventId: 'event-1',
        subEventId: 'main-event:event-1'
      }
    );
    expect(result.invitedUserIds).toEqual(['invitee']);
  });
});
