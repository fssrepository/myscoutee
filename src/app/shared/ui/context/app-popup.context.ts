import { Injectable, inject } from '@angular/core';

import { PopupStore } from './stores/popup.store';

export type {
  ActivitiesNavigationRequest,
  ActivityInvitePopupState,
  AdminNavigatorRequest,
  DemoBootstrapSelectorMode,
  DemoBootstrapSelectorState,
  EventSubeventsListPopupRequest,
  EventTournamentGroupsPopupRequest,
  NavigatorActivitiesRequest,
  NavigatorAssetRequest,
  NavigatorEventFeedbackRequest
} from './app-popup-context.types';

@Injectable({
  providedIn: 'root'
})
export class AppPopupContext {
  readonly popupStore = inject(PopupStore);
}
