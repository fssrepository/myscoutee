import type { UsersDataSourceQueryOptions } from '../../../users/users-data-source';

export const USERS_POPUP_KEY_DEMO_SELECTOR = 'demo-user-selector';

interface DemoUsersRouteQueryConfigEntry {
  routePrefix: string;
  popupKey?: string;
  demoDelayOptions?: UsersDataSourceQueryOptions;
}

const DEFAULT_DEMO_USERS_DELAY_OPTIONS: UsersDataSourceQueryOptions = {
  demoAdditionalDelayMs: 300
};

const DEMO_USERS_ROUTE_QUERY_CONFIG: DemoUsersRouteQueryConfigEntry[] = [
  {
    routePrefix: '/game',
    popupKey: USERS_POPUP_KEY_DEMO_SELECTOR,
    demoDelayOptions: {
      demoAdditionalDelayMs: 0
    }
  }
];

export function resolveDemoUsersQueryOptionsForRoute(
  url: string,
  popupKey?: string,
  overrides?: UsersDataSourceQueryOptions
): UsersDataSourceQueryOptions {
  const normalizedUrl = normalizeRouteUrl(url);
  let matched: DemoUsersRouteQueryConfigEntry | null = null;

  for (const candidate of DEMO_USERS_ROUTE_QUERY_CONFIG) {
    const normalizedPrefix = normalizeRouteUrl(candidate.routePrefix);
    if (!isRoutePrefixMatch(normalizedUrl, normalizedPrefix)) {
      continue;
    }
    if (!isPopupMatch(candidate.popupKey, popupKey)) {
      continue;
    }
    if (
      !matched
      || isCandidateMoreSpecific(candidate, matched, popupKey)
    ) {
      matched = candidate;
    }
  }

  return mergeDemoUsersQueryOptions(DEFAULT_DEMO_USERS_DELAY_OPTIONS, matched?.demoDelayOptions, overrides);
}

function normalizeRouteUrl(url: string): string {
  const [pathOnly] = url.split('?');
  const [withoutHash] = (pathOnly || '').split('#');
  const trimmed = withoutHash.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') : `/${trimmed}`.replace(/\/+$/, '');
}

function isRoutePrefixMatch(url: string, prefix: string): boolean {
  if (prefix === '/') {
    return true;
  }
  return url === prefix || url.startsWith(`${prefix}/`);
}

function isPopupMatch(configuredPopupKey: string | undefined, requestedPopupKey: string | undefined): boolean {
  if (!requestedPopupKey) {
    return !configuredPopupKey;
  }
  return configuredPopupKey === requestedPopupKey || !configuredPopupKey;
}

function isCandidateMoreSpecific(
  candidate: DemoUsersRouteQueryConfigEntry,
  current: DemoUsersRouteQueryConfigEntry,
  requestedPopupKey: string | undefined
): boolean {
  const currentPrefix = normalizeRouteUrl(current.routePrefix);
  const candidatePrefix = normalizeRouteUrl(candidate.routePrefix);
  if (candidatePrefix.length !== currentPrefix.length) {
    return candidatePrefix.length > currentPrefix.length;
  }
  const currentPopupSpecific = current.popupKey === requestedPopupKey;
  const candidatePopupSpecific = candidate.popupKey === requestedPopupKey;
  return candidatePopupSpecific && !currentPopupSpecific;
}

function mergeDemoUsersQueryOptions(
  ...sources: Array<UsersDataSourceQueryOptions | undefined>
): UsersDataSourceQueryOptions {
  const merged: UsersDataSourceQueryOptions = {};
  for (const source of sources) {
    if (!source) {
      continue;
    }
    if (source.demoAdditionalDelayMs !== undefined) {
      merged.demoAdditionalDelayMs = source.demoAdditionalDelayMs;
    }
  }
  return merged;
}
