import { describe, expect, it, vi } from 'vitest';

import type { ActivityEventDTO } from '../../../../../shared/core/contracts/activity.interface';
import type { InfoCardData } from '../../../../../shared/ui';

import { ActivitiesEventsController } from './activities-event-template.component';

describe('ActivitiesEventsController publication sync', () => {
  it.each([
    { action: 'publish', initialStatus: 'DR', expectedStatus: 'A' },
    { action: 'unpublish', initialStatus: 'A', expectedStatus: 'DR' }
  ] as const)('syncs the source DTO immediately after $action', async ({
    action,
    initialStatus,
    expectedStatus
  }) => {
    const row = {
      id: 'event-a',
      title: 'Event A',
      status: initialStatus,
      smartListKey: 'hosting:event-a'
    } as InfoCardData;
    const source = {
      id: row.id,
      title: row.title,
      status: initialStatus,
      creatorUserId: 'casey',
      adminIds: ['casey'],
      acceptedMemberUserIds: ['casey'],
      pendingMemberUserIds: [],
      invitedMemberUserIds: [],
      pendingRequestMemberUserIds: []
    } as ActivityEventDTO;
    const emitActivityEventSync = vi.fn();
    const patchVisibleItem = vi.fn();
    let confirmation: { onConfirm: () => Promise<void> } | null = null;
    const lifecycleResult = {
      sourceId: row.id,
      action,
      membershipStatus: 'unchanged',
      acceptedMembers: 1,
      pendingMembers: 0,
      capacityTotal: 8,
      full: false,
      changed: true,
      counterDelta: null
    };
    const host = {
      activeUser: { id: 'casey', activities: {} },
      activitiesEventScope: 'my-events',
      hostingPublicationFilter: 'all',
      activeHostingIds: new Set(initialStatus === 'A' ? [row.id] : []),
      activityRowIdentity: (item: InfoCardData) => `hosting:${item.id}`,
      activitiesSmartList: {
        sourceItemSnapshot: vi.fn(() => source),
        patchVisibleItem,
        removeVisibleItemByIdentity: vi.fn()
      },
      activitiesStore: { emitActivityEventSync },
      eventsService: {
        publishItem: vi.fn(async () => lifecycleResult),
        unpublishItem: vi.fn(async () => lifecycleResult),
        peekKnownItemById: vi.fn(() => null)
      },
      dialogStore: {
        open: vi.fn((value: { onConfirm: () => Promise<void> }) => {
          confirmation = value;
        })
      },
      refreshSectionBadges: vi.fn(),
      cdr: { markForCheck: vi.fn() }
    };
    const controller = new ActivitiesEventsController(host as never);

    if (action === 'publish') {
      controller.runActivityItemPublishAction(row);
    } else {
      controller.runActivityItemUnpublishAction(row);
    }
    expect(confirmation).not.toBeNull();
    await confirmation!.onConfirm();

    expect(emitActivityEventSync).toHaveBeenCalledOnce();
    expect(emitActivityEventSync).toHaveBeenCalledWith({
      ...source,
      status: expectedStatus
    });
    expect(patchVisibleItem).not.toHaveBeenCalled();
  });
});
