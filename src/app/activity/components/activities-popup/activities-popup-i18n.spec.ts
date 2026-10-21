import { ActivitiesPopupComponent } from './activities-popup.component';
import { APP_STATIC_DATA } from '../../../shared/core/common/app-static-data';
import huBundle from '../../../../assets/i18n/hu.json';

describe('Activity labels without an English reference catalog', () => {
  const messages: Record<string, string> = huBundle.messages;
  function component(state: Record<string, unknown> = {}): any {
    return Object.assign(Object.create(ActivitiesPopupComponent.prototype), {
      i18nService: {
        translate: (key: string) => {
          if (!Object.hasOwn(messages, key)) throw new Error(`Expected an explicit translation key: ${key}`);
          return messages[key];
        }
      },
      activitiesPrimaryFilter: 'rates',
      activitiesRateFilter: 'individual-given',
      activitiesView: 'day',
      ...state
    });
  }

  it('formats the rate header from independently translated labels', () => {
    expect(component().activitiesHeaderLineOne()).toBe(
      `${messages['activity.rates.group.preferences']} · ${messages['given']}`
    );
  });

  it('formats the event calendar and watchlist without English fragments', () => {
    expect(component({
      activitiesPrimaryFilter: 'events', activitiesEventScope: 'watchlist', activitiesView: 'week'
    }).activitiesHeaderLineOne()).toBe(`${messages['events']} · ${messages['activity.events.watchlist.label']}`);
  });

  it('resolves the chat context from its key while retaining the menu group identities', () => {
    expect(component({
      activitiesPrimaryFilter: 'chats', activitiesChatContextFilter: 'event'
    }).activitiesHeaderLineOne()).toBe(`${messages['chats']} · ${messages['event']}`);
    expect(APP_STATIC_DATA.rateFilterEntries.filter(row => row.kind === 'group').map(row => row.label))
      .toEqual(['Preferences', 'Suggestions']);
    for (const group of APP_STATIC_DATA.rateFilterEntries) {
      if (group.kind === 'group') expect(messages[group.labelKey]).toBeTruthy();
    }
  });
});
