import type {
  AppMenuItem,
  AppMenuItemSelectEvent,
  RatingStarBarConfig
} from '../components';

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
  static readonly ratingItemId = 'rating';

  static convert(subject: ActivityRateMenuSubject | null | undefined): readonly AppMenuItem<string, ActivityRateMenuContext>[] {
    if (!subject) {
      return [];
    }
    const { value: _configuredValue, ...ratingBarConfig } = subject.ratingBarConfig;
    return [{
      id: this.ratingItemId,
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

  static isActivityRateMenuEvent(event: AppMenuItemSelectEvent<string, unknown>): boolean {
    const context = this.contextFromEvent(event);
    return context?.menu === 'activity-rate-card';
  }

  static selectionFromEvent(event: AppMenuItemSelectEvent<string, unknown>): ActivityRateMenuSelection | null {
    const context = this.contextFromEvent(event);
    if (!context || event.id !== this.ratingItemId) {
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
