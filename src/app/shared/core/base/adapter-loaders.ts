import type { Type } from '@angular/core';

const ADAPTER_SUFFIXES = {
  ACTIVITY_INVITE_CANDIDATES: "ActivityInviteCandidatesService",
  ACTIVITY_MEMBERS: "ActivityMembersService",
  ACTIVITY_RESOURCES: "ActivityResourcesService",
  ADMIN_AFFINITY_GRAPH: "AdminAffinityGraphService",
  ADMIN_MODERATION: "AdminModerationService",
  ADMIN_MONITORING: "AdminMonitoringService",
  ADMIN_NOTIFICATIONS: "AdminNotificationsService",
  ADMIN_PARAMS: "AdminParamsService",
  ADMIN_STATS: "AdminStatsService",
  ADMIN_WORKSPACE: "AdminWorkspaceService",
  ASSET_TICKETS: "AssetTicketsService",
  ASSETS: "AssetsService",
  CAMPAIGNS: "CampaignsService",
  CASE_APPOINTMENTS: "CaseAppointmentsService",
  CHATS: "ChatsService",
  COMMUNITY_ANNOUNCEMENTS: "CommunityAnnouncementsService",
  COMMUNITY_CASES: "CommunityCasesService",
  COMMUNITY_GROUPS: "CommunityGroupsService",
  CONTACTS: "ContactsService",
  CONTENT_MODERATION: "ContentModerationService",
  DEPLOYMENT_CONFIGURATION: "DeploymentConfigurationService",
  DEVICE_REGISTRATIONS: "DeviceRegistrationsService",
  EVENTS: "EventsService",
  FEEDBACK: "FeedbackService",
  FOLLOWING: "FollowingService",
  GAME: "GameService",
  HELP_CENTER: "HelpCenterService",
  IDEA_POSTS: "IdeaPostsService",
  INTEGRATION: "IntegrationService",
  LANDING_CONTENT: "LandingContentService",
  MEDIA: "MediaService",
  NOTIFICATIONS: "NotificationsService",
  OPERATOR_EMAIL: "OperatorEmailService",
  OPERATOR_REGISTRY: "OperatorRegistryService",
  PAYMENT_METHODS: "PaymentMethodsService",
  PHOTO_FEED: "PhotoFeedService",
  RATES: "RatesService",
  SERVICE_OFFERINGS: "ServiceOfferingsService",
  SHARE_TOKENS: "ShareTokensService",
  USER_EXPERIENCES: "UserExperiencesService",
  USERS: "UsersService"
} as const;

type AdapterNames<P extends string> = { readonly [K in keyof typeof ADAPTER_SUFFIXES]: `${P}${typeof ADAPTER_SUFFIXES[K]}` };

function adapterNames<P extends 'Local' | 'Http'>(prefix: P): AdapterNames<P> {
  return Object.fromEntries(Object.entries(ADAPTER_SUFFIXES).map(([key, suffix]) => [key, `${prefix}${suffix}`])) as AdapterNames<P>;
}

export const LOCAL_ADAPTER = adapterNames('Local');
export const HTTP_ADAPTER = adapterNames('Http');

type LocalTypes = typeof import('./local-adapters').LOCAL_ADAPTER_TYPES;
type HttpTypes = typeof import('./http-adapters').HTTP_ADAPTER_TYPES;
export type AdapterKey = keyof LocalTypes | keyof HttpTypes;
export type AdapterInstance<K extends AdapterKey> = InstanceType<(LocalTypes & HttpTypes)[K]>;
export type AdapterMode = 'local' | 'http';
const constructors: Partial<Record<AdapterKey, Type<unknown>>> = {};
let localModule: Promise<LocalTypes> | undefined;
let httpModule: Promise<HttpTypes> | undefined;
let httpEntryModule: Promise<void> | undefined;

// One cached load per transport phase. Route selection stays in BaseRouteModeService.
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

export async function preloadAdapterMode(mode: AdapterMode, phase: 'entry' | 'workspace' = 'workspace'): Promise<void> {
  if (mode === 'http' && phase === 'entry') {
    await (httpEntryModule ??= import('./http-entry-adapters').then(module => {
      Object.assign(constructors, module.HTTP_ENTRY_ADAPTER_TYPES);
    }).catch(error => { httpEntryModule = undefined; throw error; }));
    return;
  }
  await ADAPTER_MODE_LOADERS[mode]();
}

export function cachedAdapterType<K extends AdapterKey>(key: K): Type<AdapterInstance<K>> | undefined {
  return constructors[key] as Type<AdapterInstance<K>> | undefined;
}

type AdapterLoaders = { [K in AdapterKey]: () => Promise<Type<AdapterInstance<K>>> };

export const ADAPTER_LOADERS = Object.fromEntries([
  ...Object.values(LOCAL_ADAPTER).map(key => [key, () => loadLocal().then(types => types[key])]),
  ...Object.values(HTTP_ADAPTER).map(key => [key, () => constructors[key]
    ? Promise.resolve(constructors[key]) : loadHttp().then(types => types[key])])
]) as AdapterLoaders;
