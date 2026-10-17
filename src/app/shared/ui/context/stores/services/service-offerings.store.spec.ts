import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DialogStore } from '@fssrepository/myscoutee-components';
import { CaseAppointmentsService } from '../../../../core/base/services/community/case-appointments.service';
import { ServiceOfferingsService } from '../../../../core/base/services/community/service-offerings.service';
import { GroupWorkspaceContextService } from '../../../../core/base/services/groups/group-workspace-context.service';
import { GameService } from '../../../../core/base/services/accounts/game.service';
import { ActivityMembersService } from '../../../../core/base/services/events/activity-members.service';
import { COMMUNITY_BASE_GROUP_ID } from '../../../../core/contracts/groups/group-type';
import type { GroupWorkspace } from '../../../../core/contracts/groups/community-group.interface';
import type { ServiceOfferingItem } from '../../../../core/contracts/community/service-offering.interface';
import { ActivityInvitePopupStore } from '../activity/activity-invite-popup.store';
import { GroupWorkspaceStore } from '../community/group-workspace.store';
import { ProfileStore } from '../profile/profile.store';
import { UserProfileStore } from '../profile/user-profile.store';
import { ServiceOfferingsStore } from './service-offerings.store';

describe('Service offering workspace identity', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each(['group-persisted-profile-uuid', 'group:myscoutee-community:account'])(
    'uses the provided base profile %s for discovery and rating from base and private workspaces', async profileId => {
      const context = new GroupWorkspaceContextService();
      const base = { groupId: COMMUNITY_BASE_GROUP_ID, profileId, groupType: 'community' } as GroupWorkspace;
      context.accountUserId.set('account');
      context.active.set(base);
      const activeUserId = signal(profileId);
      const page = vi.fn().mockResolvedValue({ items: [], total: 0, nextCursor: null });
      const rate = vi.fn();
      TestBed.configureTestingModule({ providers: [ServiceOfferingsStore,
        { provide: GroupWorkspaceContextService, useValue: context },
        { provide: GroupWorkspaceStore, useValue: { workspaces: signal([base]) } },
        { provide: UserProfileStore, useValue: { activeUserId } },
        { provide: ServiceOfferingsService, useValue: { page } },
        { provide: GameService, useValue: { recordUserGameCardRating: rate } },
        ...[CaseAppointmentsService, ActivityMembersService, ActivityInvitePopupStore, ProfileStore, DialogStore]
          .map(provide => ({ provide, useValue: {} }))
      ] });
      const store = TestBed.inject(ServiceOfferingsStore);
      const query = { page: 0, pageSize: 10, filters: { scope: 'discover' as const } };
      await expect(store.page(query)).resolves.toMatchObject({ items: [], total: 0 });
      expect(page).toHaveBeenLastCalledWith(profileId, query, undefined);

      context.active.set({ ...base, groupId: 'private-community', profileId: 'private-profile' });
      activeUserId.set('private-profile');
      await store.page(query);
      expect(page).toHaveBeenLastCalledWith(profileId, query, undefined);
      store.rate({ ownerUserId: 'provider-profile', canManage: false } as ServiceOfferingItem, 7);
      expect(rate).toHaveBeenCalledWith(profileId, 'provider-profile', 7, 'single', undefined, undefined, undefined, undefined);
    });
});
