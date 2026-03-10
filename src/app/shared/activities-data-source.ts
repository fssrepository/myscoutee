import { InjectionToken } from '@angular/core';

import type * as AppTypes from './app-types';
import type { ActivitiesEventSyncPayload, ActivitiesPageRequest, ActivitiesPageResult } from './activities-models';
import type { ChatMenuItem } from './demo-data';

export type ActivitiesDataSourceMode = 'demo' | 'http';

export interface ActivitiesDataSource {
  mode: ActivitiesDataSourceMode;
  syncEvent(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void>;
  loadChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]>;
  loadActivitiesPage(request: ActivitiesPageRequest): Promise<ActivitiesPageResult | null>;
}

export const ACTIVITIES_DATA_SOURCE = new InjectionToken<ActivitiesDataSource>('ACTIVITIES_DATA_SOURCE');
