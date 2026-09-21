import { signal } from '@angular/core';
import { ActivityEventDetailDTO } from '../../../shared/core/contracts/activity.interface';
import { EventEditorPopupComponent } from './event-editor-popup.component';

describe('Event editor mode isolation', () => {
  function editor(mode: 'Casual' | 'Tournament' | 'Mingle') {
    const detail = new ActivityEventDetailDTO().apply({ id: 'event', mode });
    const component = Object.create(EventEditorPopupComponent.prototype);
    Object.assign(component, {
      eventDetailLoadSequence: 0, editingEventId: 'event', editorTarget: 'hosting',
      activeUserId: () => 'owner', resetEditorContext: vi.fn(), refreshCurrentMemberSummary: vi.fn(),
      activityMembersService: { peekSummaryByOwnerId: () => null },
      eventEditorStore: { isOpen: () => true, open: vi.fn() },
      routeDelay: { withRequestTimeout: (_route: string, request: Promise<unknown>) => request },
      eventsService: { loadEventDetailById: vi.fn().mockResolvedValue(detail),
        queryMingleState: vi.fn().mockResolvedValue({ eventId: 'event', roundNumber: 3 }) },
      isLoadingEventData: signal(false), eventVisibilityReady: signal(false), minimumMinglePlannedRounds: signal(1),
      eventDetailDTOBelongsToActiveAdmin: () => true, openEventDetailDTO: vi.fn()
    });
    return { component, detail };
  }

  for (const mode of ['Casual', 'Tournament', 'Mingle'] as const) {
    for (const operation of ['open', 'publication reload']) {
      it(`${operation} keeps ${mode} independent of unrelated runtime endpoints`, async () => {
        const { component, detail } = editor(mode);
        if (operation === 'open') await component.openEditRequest('event', 'hosting', false);
        else await component.reloadEventEditorAfterPublication('event', 'A');
        expect(component.openEventDetailDTO).toHaveBeenCalledWith(detail, false, 'hosting');
        expect(component.eventsService.queryMingleState).toHaveBeenCalledTimes(mode === 'Mingle' ? 1 : 0);
        expect(component.minimumMinglePlannedRounds()).toBe(mode === 'Mingle' ? 3 : 1);
      });
    }
  }

  it('does not query live rounds for an editor request that was replaced while loading', async () => {
    const { component } = editor('Mingle');
    component.eventsService.loadEventDetailById.mockImplementation(async () => {
      component.editingEventId = 'another-event';
      return new ActivityEventDetailDTO().apply({ id: 'event', mode: 'Mingle' });
    });
    await component.openEditRequest('event', 'hosting', false);
    expect(component.eventsService.queryMingleState).not.toHaveBeenCalled();
    expect(component.openEventDetailDTO).not.toHaveBeenCalled();
  });
});
