import type {
  AppMenuItem,
  AppMenuItemSelectEvent,
  RatingStarBarConfig
} from '../components';
import type { UiConverter } from './converter.types';

const ACTIVITY_RATE_MENU_RATING_ITEM_ID = 'rating';

export interface ActivityRateMenuSubject {
  menu: 'activity-rate-card';
  id: string;
  value: number;
  ratingBarConfig: RatingStarBarConfig;
}

export interface ActivityRateMenuContext {
  menu: 'activity-rate-card';
  subject: ActivityRateMenuSubject;
}

export interface ActivityRateMenuSelection {
  rowId: string;
  value: number;
}

export class ActivityRateMenuConverter {
  static convert(subject: ActivityRateMenuSubject | null | undefined): readonly AppMenuItem<string, ActivityRateMenuContext>[] {
    if (!subject) {
      return [];
    }
    const { value: _configuredValue, ...ratingBarConfig } = subject.ratingBarConfig;
    return [{
      id: ACTIVITY_RATE_MENU_RATING_ITEM_ID,
      kind: 'rating-bar',
      closeOnSelect: true,
      value: subject.value,
      ratingBarConfig,
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
