import {
  type RatingSnapshot,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuRateConfig,
  type UiConverter
} from '@myscoutee/components';

const ACTIVITY_RATE_MENU_RATING_ITEM_ID = 'rating';

export interface ActivityRateMenuSubject {
  menu: 'activity-rate-card';
  id: string;
  value: number;
  ratingBarConfig: AppMenuRateConfig;
}

export interface ActivityRateMenuContext {
  menu: 'activity-rate-card';
  subject: ActivityRateMenuSubject;
}

export interface ActivityRateMenuSelection {
  ratingSnapshot?: RatingSnapshot;
  rowId: string;
  value: number;
}

export class ActivityRateMenuConverter {
  static convert(subject: ActivityRateMenuSubject | null | undefined): readonly AppMenuItem<string, ActivityRateMenuContext>[] {
    if (!subject) {
      return [];
    }
    const { value: _configuredValue, ...rateConfig } = subject.ratingBarConfig;
    return [{
      id: ACTIVITY_RATE_MENU_RATING_ITEM_ID,
      kind: 'rate',
      closeOnSelect: true,
      value: subject.value,
      rateConfig,
      context: {
        menu: 'activity-rate-card',
        subject
      }
    }];
  }
}

export class ActivityRateMenuSelectionConverter {
  static convert(event: AppMenuItemSelectEvent<string, unknown>): ActivityRateMenuSelection | null {
    const context = this.contextFromEvent(event);
    if (!context || event.id !== ACTIVITY_RATE_MENU_RATING_ITEM_ID) {
      return null;
    }
    const value = Number(event.value);
    if (!Number.isFinite(value)) {
      return null;
    }
    return {
      rowId: context.subject.id,
      ratingSnapshot: event.ratingSnapshot,
      value
    };
  }

  private static contextFromEvent(event: AppMenuItemSelectEvent<string, unknown>): ActivityRateMenuContext | null {
    const context = event.context as Partial<ActivityRateMenuContext> | null | undefined;
    return context?.menu === 'activity-rate-card' && context.subject?.menu === 'activity-rate-card'
      ? context as ActivityRateMenuContext
      : null;
  }
}

export const activityRateMenuConverter =
  ActivityRateMenuConverter satisfies UiConverter<
    ActivityRateMenuSubject | null | undefined,
    readonly AppMenuItem<string, ActivityRateMenuContext>[]
  >;

export const activityRateMenuSelectionConverter =
  ActivityRateMenuSelectionConverter satisfies UiConverter<
    AppMenuItemSelectEvent<string, unknown>,
    ActivityRateMenuSelection | null
  >;
