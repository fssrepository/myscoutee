import { ChangeDetectorRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivityMembersService, ActivitiesService, EventsService, GameService, ShareTokensService, UsersService } from '../../../shared/core';
import { AppMenuDispatcher } from '../../../shared/ui';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { ProfileStore } from '../../../shared/ui/context/stores/profile.store';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import { EventCheckoutDraftStore } from '../../../shared/ui/context/stores/event-checkout-draft.store';
import { EventCheckoutDialogStore } from '../../../shared/ui/context/stores/event-checkout-dialog.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import { ActivityStore } from '../../../shared/ui/context/stores/activity.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';
import { EventSubeventsPopupStore } from '../../../shared/ui/context/stores/event-subevents-popup.store';
import { EventExplorePopupComponent } from './event-explore-popup.component';

const defaults = { friendsOnly: false, openSpotsOnly: false, topic: '', mode: '' as const };
const saved = { friendsOnly: true, openSpotsOnly: true, topic: '#Music', mode: 'Tournament' as const };
const query = { page: 0, pageSize: 20, filters: { userId: 'user', order: 'upcoming', view: 'day', ...defaults } };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function popup() {
  const pending = deferred<typeof saved>();
  const component = Object.create(EventExplorePopupComponent.prototype);
  Object.assign(component, {
    isOpen: false, activeUserId: 'user', exploreOpenRevision: 0, preferencesRequest: null,
    eventExploreFilters: signal({ ...defaults }), preferencesReady: signal(false),
    eventExploreOrder: 'upcoming', eventExploreView: 'day', eventExploreSortKeys: new Map(),
    usersService: { loadPageFilterPreferences: vi.fn().mockReturnValue(pending.promise) },
    activitiesService: { loadExplore: vi.fn().mockResolvedValue({ items: [], total: 0 }) },
    eventCheckoutDraftStore: { reconcileExpiredEventDrafts: vi.fn() },
    cdr: { markForCheck: vi.fn() }, dialogStore: { open: vi.fn() },
    prewarmEventEditorPopup: vi.fn(), refreshUsersDirectory: vi.fn(), closeMembersPopup: vi.fn(),
    restoreServerCheckoutDrafts: vi.fn().mockResolvedValue(undefined), reloadEventExploreSmartList: vi.fn()
  });
  return { component, pending };
}

describe('Explore nonblocking preference loading', () => {
  it('opens immediately and lets the list lazily load saved filters before requesting any events', async () => {
    const { component, pending } = popup();
    component.openEventExplore();
    expect(component.isOpen).toBe(true);
    expect(component.usersService.loadPageFilterPreferences).not.toHaveBeenCalled();
    const load = component.loadEventExplorePage(query);
    expect(component.activitiesService.loadExplore).not.toHaveBeenCalled();
    pending.resolve(saved);
    await load;
    expect(component.eventExploreFilters()).toEqual(saved);
    expect(component.preferencesReady()).toBe(true);
    expect(component.activitiesService.loadExplore).toHaveBeenCalledExactlyOnceWith({ ...query,
      filters: { ...query.filters, ...saved, topic: 'music' } });
    expect(component.reloadEventExploreSmartList).not.toHaveBeenCalled();
    await component.loadEventExplorePage({ ...query, page: 1, cursor: 'next' });
    expect(component.usersService.loadPageFilterPreferences).toHaveBeenCalledTimes(1);
    expect(component.activitiesService.loadExplore).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next',
      filters: expect.objectContaining({ mode: 'Tournament', friendsOnly: true }) }));
  });

  it('shares preference loading when a sort change cancels the first list request', async () => {
    const { component, pending } = popup();
    component.openEventExplore();
    const controller = new AbortController();
    const first = component.loadEventExplorePage(query, controller.signal);
    const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    const second = component.loadEventExplorePage({ ...query, filters: { ...query.filters, order: 'most-relevant' } });
    pending.resolve(saved);
    await cancelled;
    await second;
    expect(component.usersService.loadPageFilterPreferences).toHaveBeenCalledTimes(1);
    expect(component.activitiesService.loadExplore).toHaveBeenCalledTimes(1);
    expect(component.activitiesService.loadExplore).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.objectContaining({ order: 'most-relevant', mode: 'Tournament' }) }));
  });

  for (const change of ['close', 'user change', 'reopen']) {
    it(`ignores late preferences after ${change}`, async () => {
      const { component, pending } = popup();
      component.openEventExplore();
      const load = component.loadEventExplorePage(query);
      const cancelled = expect(load).rejects.toMatchObject({ name: 'AbortError' });
      if (change === 'user change') component.activeUserId = 'other';
      else { component.isOpen = false; component.exploreOpenRevision++; }
      if (change === 'reopen') component.openEventExplore();
      pending.resolve(saved);
      await cancelled;
      expect(component.eventExploreFilters()).toEqual(defaults);
      expect(component.activitiesService.loadExplore).not.toHaveBeenCalled();
      expect(component.dialogStore.open).not.toHaveBeenCalled();
    });
  }

  it('keeps the popup open on preference failure and retries without loading unfiltered events', async () => {
    const { component, pending } = popup();
    component.openEventExplore();
    const load = component.loadEventExplorePage(query);
    const failed = expect(load).rejects.toThrow('Explore preferences unavailable');
    pending.reject(new Error('offline'));
    await failed;
    expect(component.isOpen).toBe(true);
    expect(component.activitiesService.loadExplore).not.toHaveBeenCalled();
    expect(component.preferencesRequest).toBeNull();
    component.usersService.loadPageFilterPreferences.mockResolvedValue(saved);
    component.dialogStore.open.mock.calls[0][0].onConfirm();
    expect(component.reloadEventExploreSmartList).toHaveBeenCalledTimes(1);
    await component.loadEventExplorePage(query);
    expect(component.preferencesReady()).toBe(true);
    expect(component.activitiesService.loadExplore).toHaveBeenCalledTimes(1);
  });

  it('puts Filters before Order and View and uses mobile-collapsible menu triggers', () => {
    const { component } = popup();
    Object.assign(component, { filterCount: () => 0,
      eventExploreHeaderTitle: () => 'Explore', eventExploreOrderOptions: [], eventExploreViewOptions: [] });
    const model = component.eventExplorePopupModel();
    expect(model.headerControls.map((control: { id: string }) => control.id)).toEqual([
      'event-explore-filters', 'event-explore-order', 'event-explore-view'
    ]);
    expect(model.headerControls[0].compactOnMobile).toBe(true);
    expect(model.headerControls[1].trigger.collapsible).toBe(true);
    expect(model.headerControls[2].trigger.collapsible).toBe(true);
  });
});

describe('Explore first navigation', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  it('keeps the first pending Explore request open when the lazy component initializes its user', () => {
    const userId = signal('user');
    const request = signal<unknown>({ type: 'eventExplore', updatedMs: 1 });
    TestBed.configureTestingModule({ providers: [
      ...[ActivityMembersService, ActivitiesService, EventsService, ShareTokensService, UsersService,
        ProfileStore, DialogStore, AppMenuDispatcher, EventCheckoutDialogStore].map(provide => ({ provide, useValue: {} })),
      { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
      { provide: GameService, useValue: { getGameCardsUsersSnapshot: () => [] } },
      { provide: UserProfileStore, useValue: { activeUserId: userId, activeUserProfile: () => null } },
      { provide: AppRuntimeStore, useValue: { isDataSourceAvailable: () => true } },
      { provide: ActivityStore, useValue: { activityMembersSync: signal(null), activityEventRuntimeSync: signal(null) } },
      { provide: MemberMenuStore, useValue: { activitiesNavigationRequest: request,
        clearActivitiesNavigationRequest: () => request.set(null) } },
      { provide: ActivitiesPopupStore, useValue: { activityEventSave: signal(null) } },
      { provide: EventSubeventsPopupStore, useValue: { eventSubeventsListPopup: signal(null) } },
      { provide: EventCheckoutDraftStore, useValue: { drafts: signal([]) } }
    ] });
    vi.spyOn(EventExplorePopupComponent.prototype as unknown as { prewarmEventEditorPopup(): void },
      'prewarmEventEditorPopup').mockImplementation(() => undefined);
    const component = TestBed.runInInjectionContext(() => new EventExplorePopupComponent());
    const view = component as unknown as { isOpen: boolean; activeUserId: string };
    TestBed.tick();
    expect(request()).toBeNull();
    expect(view.activeUserId).toBe('user');
    expect(view.isOpen).toBe(true);
    userId.set('other-user');
    TestBed.tick();
    expect(view.isOpen).toBe(false);
  });
});
