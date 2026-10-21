import { ActivitiesPopupComponent } from './activities-popup.component';
import { POPUP_WARMUP } from '../../../shared/ui/context/popup-adapter-loaders';

describe('Activity list parallel feature loading', () => {
  it.each([
    ['rates', 'loadActivityRates', 'activityRates'],
    ['chats', 'loadActivityChats', 'activityChats']
  ] as const)('starts %s data without waiting for the next popup code', async (filter, method, phase) => {
    let resolveData!: (value: any) => void;
    const data = new Promise<any>(resolve => { resolveData = resolve; });
    const request = vi.fn(() => data);
    const prepare = vi.fn();
    const controller = new AbortController();
    const component = Object.assign(Object.create(ActivitiesPopupComponent.prototype), {
      activitiesPrimaryFilter: filter,
      popupAdapters: { prepare },
      activitiesService: { [method]: request },
      activitiesSmartList: { convertItems: (items: unknown[]) => items }
    });
    const result = component.loadActivitiesSmartListPage({ page: 0, pageSize: 20 }, { signal: controller.signal });
    expect(request).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledWith(POPUP_WARMUP[phase], controller.signal);
    resolveData({ items: [{ id: 'row' }], total: 1 });
    expect(await result).toEqual({ items: [{ id: 'row' }], total: 1, nextCursor: null });
    prepare.mockClear();
    await component.loadActivitiesSmartListPage({ page: 1, pageSize: 20 });
    expect(prepare).not.toHaveBeenCalled();
  });
});
