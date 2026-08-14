import { describe, expect, it, vi } from 'vitest';

import type { ActivityEventDTO } from '../../../shared/core/contracts/activity.interface';
import type { InfoCardData } from '../../../shared/ui';

import { ActivitiesPopupComponent } from './activities-popup.component';

describe('ActivitiesPopupComponent member sync source', () => {
  const row = {
    id: 'event-a',
    smartListKey: 'hosting:event-a',
    mediaEnd: {
      variant: 'badge',
      label: '2 / 3',
      interactive: true,
      pendingCount: 1
    }
  } as InfoCardData;
  const source = {
    id: row.id,
    acceptedMembers: 2,
    pendingMembers: 1,
    capacityTotal: 3,
    capacityMax: 3,
    acceptedMemberUserIds: ['casey', 'nova'],
    pendingMemberUserIds: ['riley'],
    invitedMemberUserIds: ['riley'],
    pendingRequestMemberUserIds: []
  } as ActivityEventDTO;

  it('resolves a server-backed event from the Smart List source when the event cache misses', () => {
    const component = Object.create(ActivitiesPopupComponent.prototype) as any;
    const peekKnownItemById = vi.fn(() => null);
    component.activitiesSmartList = {
      sourceItemSnapshot: vi.fn(() => source),
      sourceItemsSnapshot: vi.fn(() => [source])
    };
    component.eventsService = { peekKnownItemById };

    expect(component.activityEventDTOForRow(row)).toBe(source);
    expect(peekKnownItemById).not.toHaveBeenCalled();
  });

  it('patches the converted row from that source and preserves its known capacity', () => {
    const component = Object.create(ActivitiesPopupComponent.prototype) as any;
    const patchConvertedVisibleItem = vi.fn(() => true);
    component.activitiesSmartList = {
      sourceItemSnapshot: vi.fn(() => source),
      sourceItemsSnapshot: vi.fn(() => [source]),
      patchConvertedVisibleItem,
      patchVisibleItem: vi.fn()
    };
    component.eventsService = { peekKnownItemById: vi.fn(() => null) };
    component.activitiesStore = { clearActivityEventSave: vi.fn() };
    component.activityCapacityById = {};
    component.activityPendingMembersById = {};
    component.activitiesEventCardRevision = 0;
    component.activitiesEventCardRevisionByRowId = {};

    component.applyActivityMembersSyncState({
      updatedMs: 1,
      id: row.id,
      acceptedMembers: 2,
      pendingMembers: 0,
      capacityTotal: 2
    });

    expect(component.activityCapacityById[row.id]).toBe('2 / 3');
    expect(component.activityPendingMembersById[row.id]).toBe(0);
    expect(patchConvertedVisibleItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: row.id,
        acceptedMembers: 2,
        pendingMembers: 0,
        capacityTotal: 3
      }),
      expect.objectContaining({ predicate: expect.any(Function) })
    );
  });
});
