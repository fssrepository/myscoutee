import { describe, expect, it, vi } from 'vitest';

import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';

import { ActivitiesPopupComponent } from './activities-popup.component';

describe('ActivitiesPopupComponent support-case SmartList sync', () => {
  const pickedChat = {
    id: 'c-support-admin-1-user-1',
    ownerId: 'user-1',
    channelType: 'appSupport',
    supportCase: {
      status: 'picked',
      assignee: { userId: 'admin-1', name: 'Ava Moderation', initials: 'AM' }
    }
  } as ChatDTO;

  function componentForSupportFilter(filter: 'all' | 'pending') {
    const patchConvertedVisibleItem = vi.fn(() => true);
    const removeVisibleItemByIdentity = vi.fn(() => true);
    const component = Object.create(ActivitiesPopupComponent.prototype) as any;
    component.activitiesSmartList = {
      patchConvertedVisibleItem,
      removeVisibleItemByIdentity
    };
    component.activitiesPrimaryFilter = 'chats';
    component.activitiesView = 'day';
    component.activitiesChatContextFilter = 'service';
    component.activitiesStore = {
      activitiesAdminServiceOnly: vi.fn(() => true),
      activitiesSupportCaseFilter: vi.fn(() => filter)
    };
    component.activityStore = {
      signalUserSupportCaseStatusTransition: vi.fn()
    };
    component.userProfileStore = {
      activeUserProfile: vi.fn(() => ({ id: 'admin-1', activities: {} }))
    };
    component.refreshSectionBadges = vi.fn();
    component.cdr = { markForCheck: vi.fn() };
    return { component, patchConvertedVisibleItem, removeVisibleItemByIdentity };
  }

  it('patches a status transition in All instead of removing the support row', () => {
    const { component, patchConvertedVisibleItem, removeVisibleItemByIdentity } = componentForSupportFilter('all');

    component.applySupportCaseUpdate(pickedChat, 'pending');

    expect(patchConvertedVisibleItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: pickedChat.id })
    );
    expect(removeVisibleItemByIdentity).not.toHaveBeenCalled();
  });

  it('removes a picked case from the visible Pending bucket by its converted SmartList identity', () => {
    const { component, removeVisibleItemByIdentity } = componentForSupportFilter('pending');

    component.applySupportCaseUpdate(pickedChat, 'pending');

    expect(removeVisibleItemByIdentity).toHaveBeenCalledWith(
      'chats:supportCase:c-support-admin-1-user-1'
    );
  });
});
