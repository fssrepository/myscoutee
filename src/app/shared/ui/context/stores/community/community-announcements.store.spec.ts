import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogStore } from '@fssrepository/myscoutee-components';
import { CommunityAnnouncementsStore } from './community-announcements.store';
import { ActivityStore } from '../activity/activity.store';
import { ActivitiesPopupStore } from '../activity/activities-popup.store';
import { UserProfileStore } from '../profile/user-profile.store';
import { GroupWorkspaceContextService } from '../../../../core/base/services/groups/group-workspace-context.service';
import { CommunityAnnouncementsService } from '../../../../core/base/services/community/community-announcements.service';
import type { CommunityAnnouncement } from '../../../../core/contracts/community/community-announcement.interface';

describe('Announcement chat entry', () => {
  const item = { id: 'announcement', communityId: 'community-test', status: 'published' } as CommunityAnnouncement;
  let store: CommunityAnnouncementsStore;
  let workspace: GroupWorkspaceContextService;
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    open = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ActivityStore, useValue: {} },
      { provide: ActivitiesPopupStore, useValue: { openEventChat: open } },
      { provide: UserProfileStore, useValue: { activeUserId: signal('member'), activeUserProfile: signal(null) } },
      { provide: CommunityAnnouncementsService, useValue: {} },
      { provide: DialogStore, useValue: {} }
    ] });
    workspace = TestBed.inject(GroupWorkspaceContextService);
    workspace.active.set({ groupType: 'community', groupId: 'community-test', profileId: 'member', name: 'Group', role: 'Member', activity: 0, policy: {} } as any);
    store = TestBed.inject(CommunityAnnouncementsStore);
    TestBed.tick();
  });
  afterEach(() => TestBed.resetTestingModule());
  it('opens synchronously with the load request, without injecting a transport service or awaiting local delay', () => {
    expect(store.feedback(item)).toBeUndefined();
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][0]).toMatchObject({ chatId: 'c-moderation-group-member', serviceChat: { announcementId: 'announcement', serviceContext: 'groupSupport' } });
    expect(store.error()).toBe('');
  });
  it('retains the parent popup layer', () => {
    store.popup.set(true);
    store.feedback(item);
    expect(open.mock.calls[0][0].parentZIndex).toBe(14000);
  });
  it('does not open for an admin, draft or another workspace', () => {
    store.feedback({ ...item, status: 'draft' });
    store.feedback({ ...item, communityId: 'another' });
    workspace.active.update(value => ({ ...value!, role: 'Admin' }));
    store.feedback(item);
    expect(open).not.toHaveBeenCalled();
  });
});
