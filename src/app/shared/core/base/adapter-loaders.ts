import type { Type } from '@angular/core';

export const LOCAL_ADAPTER = {
  ACTIVITY_INVITE_CANDIDATES: 'LocalActivityInviteCandidatesService',
  ACTIVITY_MEMBERS: 'LocalActivityMembersService',
  ACTIVITY_RESOURCES: 'LocalActivityResourcesService',
  ADMIN_AFFINITY_GRAPH: 'LocalAdminAffinityGraphService',
  ADMIN_MODERATION: 'LocalAdminModerationService',
  ADMIN_MONITORING: 'LocalAdminMonitoringService',
  ADMIN_NOTIFICATIONS: 'LocalAdminNotificationsService',
  ADMIN_PARAMS: 'LocalAdminParamsService',
  ADMIN_STATS: 'LocalAdminStatsService',
  ADMIN_WORKSPACE: 'LocalAdminWorkspaceService',
  ASSET_TICKETS: 'LocalAssetTicketsService',
  ASSETS: 'LocalAssetsService',
  CAMPAIGNS: 'LocalCampaignsService',
  CASE_APPOINTMENTS: 'LocalCaseAppointmentsService',
  CHATS: 'LocalChatsService',
  COMMUNITY_ANNOUNCEMENTS: 'LocalCommunityAnnouncementsService',
  COMMUNITY_CASES: 'LocalCommunityCasesService',
  COMMUNITY_GROUPS: 'LocalCommunityGroupsService',
  CONTACTS: 'LocalContactsService',
  CONTENT_MODERATION: 'LocalContentModerationService',
  DEPLOYMENT_CONFIGURATION: 'LocalDeploymentConfigurationService',
  DEVICE_REGISTRATIONS: 'LocalDeviceRegistrationsService',
  EVENTS: 'LocalEventsService',
  FEEDBACK: 'LocalFeedbackService',
  FOLLOWING: 'LocalFollowingService',
  GAME: 'LocalGameService',
  HELP_CENTER: 'LocalHelpCenterService',
  IDEA_POSTS: 'LocalIdeaPostsService',
  INTEGRATION: 'LocalIntegrationService',
  LANDING_CONTENT: 'LocalLandingContentService',
  MEDIA: 'LocalMediaService',
  NOTIFICATIONS: 'LocalNotificationsService',
  OPERATOR_EMAIL: 'LocalOperatorEmailService',
  OPERATOR_REGISTRY: 'LocalOperatorRegistryService',
  PAYMENT_METHODS: 'LocalPaymentMethodsService',
  PHOTO_FEED: 'LocalPhotoFeedService',
  RATES: 'LocalRatesService',
  SERVICE_OFFERINGS: 'LocalServiceOfferingsService',
  SHARE_TOKENS: 'LocalShareTokensService',
  USER_EXPERIENCES: 'LocalUserExperiencesService',
  USERS: 'LocalUsersService'
} as const;

export const HTTP_ADAPTER = {
  ACTIVITY_INVITE_CANDIDATES: 'HttpActivityInviteCandidatesService',
  ACTIVITY_MEMBERS: 'HttpActivityMembersService',
  ACTIVITY_RESOURCES: 'HttpActivityResourcesService',
  ADMIN_AFFINITY_GRAPH: 'HttpAdminAffinityGraphService',
  ADMIN_MODERATION: 'HttpAdminModerationService',
  ADMIN_MONITORING: 'HttpAdminMonitoringService',
  ADMIN_NOTIFICATIONS: 'HttpAdminNotificationsService',
  ADMIN_PARAMS: 'HttpAdminParamsService',
  ADMIN_STATS: 'HttpAdminStatsService',
  ADMIN_WORKSPACE: 'HttpAdminWorkspaceService',
  ASSET_TICKETS: 'HttpAssetTicketsService',
  ASSETS: 'HttpAssetsService',
  CAMPAIGNS: 'HttpCampaignsService',
  CASE_APPOINTMENTS: 'HttpCaseAppointmentsService',
  CHATS: 'HttpChatsService',
  COMMUNITY_ANNOUNCEMENTS: 'HttpCommunityAnnouncementsService',
  COMMUNITY_CASES: 'HttpCommunityCasesService',
  COMMUNITY_GROUPS: 'HttpCommunityGroupsService',
  CONTACTS: 'HttpContactsService',
  CONTENT_MODERATION: 'HttpContentModerationService',
  DEPLOYMENT_CONFIGURATION: 'HttpDeploymentConfigurationService',
  DEVICE_REGISTRATIONS: 'HttpDeviceRegistrationsService',
  EVENTS: 'HttpEventsService',
  FEEDBACK: 'HttpFeedbackService',
  FOLLOWING: 'HttpFollowingService',
  GAME: 'HttpGameService',
  HELP_CENTER: 'HttpHelpCenterService',
  IDEA_POSTS: 'HttpIdeaPostsService',
  INTEGRATION: 'HttpIntegrationService',
  LANDING_CONTENT: 'HttpLandingContentService',
  MEDIA: 'HttpMediaService',
  NOTIFICATIONS: 'HttpNotificationsService',
  OPERATOR_EMAIL: 'HttpOperatorEmailService',
  OPERATOR_REGISTRY: 'HttpOperatorRegistryService',
  PAYMENT_METHODS: 'HttpPaymentMethodsService',
  PHOTO_FEED: 'HttpPhotoFeedService',
  RATES: 'HttpRatesService',
  SERVICE_OFFERINGS: 'HttpServiceOfferingsService',
  SHARE_TOKENS: 'HttpShareTokensService',
  USER_EXPERIENCES: 'HttpUserExperiencesService',
  USERS: 'HttpUsersService'
} as const;

type LocalTypes = typeof import('./local-adapters').LOCAL_ADAPTER_TYPES;
type HttpTypes = typeof import('./http-adapters').HTTP_ADAPTER_TYPES;
export type AdapterKey = keyof LocalTypes | keyof HttpTypes;
export type AdapterInstance<K extends AdapterKey> = InstanceType<(LocalTypes & HttpTypes)[K]>;
export type AdapterMode = 'local' | 'http';
const constructors: Partial<Record<AdapterKey, Type<unknown>>> = {};
let localModule: Promise<LocalTypes> | undefined;
let httpModule: Promise<HttpTypes> | undefined;

// One import/cache per side. Route selection stays in BaseRouteModeService.
function loadLocal(): Promise<LocalTypes> {
  return localModule ??= import('./local-adapters').then(module => {
    Object.assign(constructors, module.LOCAL_ADAPTER_TYPES);
    return module.LOCAL_ADAPTER_TYPES;
  }).catch(error => { localModule = undefined; throw error; });
}

function loadHttp(): Promise<HttpTypes> {
  return httpModule ??= import('./http-adapters').then(module => {
    Object.assign(constructors, module.HTTP_ADAPTER_TYPES);
    return module.HTTP_ADAPTER_TYPES;
  }).catch(error => { httpModule = undefined; throw error; });
}

export const ADAPTER_MODE_LOADERS = { local: loadLocal, http: loadHttp };

export async function preloadAdapterMode(mode: AdapterMode): Promise<void> {
  await ADAPTER_MODE_LOADERS[mode]();
}

export function cachedAdapterType<K extends AdapterKey>(key: K): Type<AdapterInstance<K>> | undefined {
  return constructors[key] as Type<AdapterInstance<K>> | undefined;
}

type AdapterLoaders = { [K in AdapterKey]: () => Promise<Type<AdapterInstance<K>>> };

export const ADAPTER_LOADERS = Object.fromEntries([
  ...Object.values(LOCAL_ADAPTER).map(key => [key, () => loadLocal().then(types => types[key])]),
  ...Object.values(HTTP_ADAPTER).map(key => [key, () => loadHttp().then(types => types[key])])
]) as AdapterLoaders;
