import type * as ContractTypes from '../../core/contracts';
import type { ChatDTO } from '../../core/contracts/chat.interface';

export interface EventChatSession {
  item: ChatDTO;
  openedAtIso: string;
}

export interface ActivitiesUiState {
  open: boolean;
  openRevision: number;
  primaryFilter: ContractTypes.ActivitiesPrimaryFilter;
  eventScope: ContractTypes.ActivitiesEventScope;
  secondaryFilter: ContractTypes.ActivitiesSecondaryFilter;
  chatContextFilter: ContractTypes.ActivitiesChatContextFilter;
  supportCaseFilter: ContractTypes.SupportCaseFilter;
  hostingPublicationFilter: ContractTypes.HostingPublicationFilter;
  rateFilter: ContractTypes.RateFilterKey;
  rateSocialBadgeEnabled: boolean;
  rateIndividualSocialBadgeEnabled: boolean;
  ratePairSocialBadgeEnabled: boolean;
  view: ContractTypes.ActivitiesView;
  showViewPicker: boolean;
  showSecondaryPicker: boolean;
  stickyValue: string;
  ratesFullscreenMode: boolean;
  selectedRateId: string | null;
  adminServiceOnly: boolean;
}

export const DEFAULT_ACTIVITIES_UI_STATE: ActivitiesUiState = {
  open: false,
  openRevision: 0,
  primaryFilter: 'chats',
  eventScope: 'active-events',
  secondaryFilter: 'recent',
  chatContextFilter: 'all',
  supportCaseFilter: 'all',
  hostingPublicationFilter: 'all',
  rateFilter: 'individual-given',
  rateSocialBadgeEnabled: false,
  rateIndividualSocialBadgeEnabled: false,
  ratePairSocialBadgeEnabled: false,
  view: 'day',
  showViewPicker: false,
  showSecondaryPicker: false,
  stickyValue: '',
  ratesFullscreenMode: false,
  selectedRateId: null,
  adminServiceOnly: false
};
