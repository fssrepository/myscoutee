import { Injectable, inject } from '@angular/core';

import { ActivityStore } from './stores/activity.store';
import { AppRuntimeStore } from './stores/app-runtime.store';
import { HelpCenterStore } from './stores/help-center.store';
import { UserProfileStore } from './stores/user-profile.store';

export {
  DEFAULT_LOAD_STATE,
  DEFAULT_USER_IMPRESSION_CHANGE_FLAGS
} from './app-context.types';
export type {
  ActivityAssetCounters,
  ActivityCounterKey,
  ActivityCounters,
  ActivityEventCounters,
  ActivityEventFeedbackCounters,
  ActivityEventFeedbackSubmitSyncState,
  ActivityMembersSyncState,
  ActivityResourceSyncState,
  AppContextAdminUserDto,
  ConnectivityState,
  LoadState,
  LoadStatus,
  UserImpressionChangeFlags
} from './app-context.types';

@Injectable({
  providedIn: 'root'
})
export class AppContext {
  readonly runtimeStore = inject(AppRuntimeStore);
  readonly userProfileStore = inject(UserProfileStore);
  readonly activityStore = inject(ActivityStore);
  readonly helpCenterStore = inject(HelpCenterStore);
}
