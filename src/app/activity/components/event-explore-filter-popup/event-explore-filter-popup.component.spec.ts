import { EventExploreFilterPopupComponent } from './event-explore-filter-popup.component';
import type { AppMenuItemSelectEvent } from '../../../shared/ui';
import type { EventExploreFilterPreferences } from '../../../shared/core/contracts/activity.interface';

class FilterHarness extends EventExploreFilterPopupComponent {
  changeMode(mode: string) { this.selectMode({ id: mode } as AppMenuItemSelectEvent); }
  changeFriends() { this.toggle({ id: 'friendsOnly' } as AppMenuItemSelectEvent); }
  popupModel() { return this.model(); }
  apply() { this.model().onMenuSelect!({} as never); }
  cancel() { this.model().onClose!(new Event('close')); }
}

describe('Explore filter draft', () => {
  it('uses a content-sized compact popup with a dim backdrop on desktop and mobile', () => {
    expect(new FilterHarness().popupModel()).toMatchObject({
      size: 'small', height: 'auto', mobilePresentation: 'compact', backdropTone: 'dim'
    });
  });
  it('keeps edits private until the header tick is clicked, and cancels without applying', () => {
    const filters: EventExploreFilterPreferences = { friendsOnly: false, openSpotsOnly: false, mode: '', topic: '' };
    const popup = new FilterHarness();
    popup.filters = filters;
    popup.ngOnChanges();
    const results: (EventExploreFilterPreferences | null)[] = [];
    popup.closed.subscribe(value => results.push(value));
    popup.changeMode('Mingle');
    popup.changeFriends();
    expect(results).toEqual([]);
    expect(filters.mode).toBe('');
    expect(filters.friendsOnly).toBe(false);
    popup.cancel();
    expect(results).toEqual([null]);
    popup.apply();
    expect(results[1]).toEqual({ ...filters, mode: 'Mingle', friendsOnly: true });
  });

  it('prevents double submission and cancellation during a save', () => {
    const popup = new FilterHarness();
    popup.filters = { friendsOnly: false, openSpotsOnly: false, mode: 'Tournament', topic: '' };
    popup.ngOnChanges();
    let emissions = 0;
    popup.closed.subscribe(() => emissions++);
    popup.saving = true;
    popup.changeMode('Mingle');
    popup.apply();
    popup.cancel();
    expect(emissions).toBe(0);
    popup.saving = false;
    popup.closed.subscribe(value => expect(value?.mode).toBe('Tournament'));
    popup.apply();
  });
});
