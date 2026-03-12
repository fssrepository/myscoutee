export type DemoUsersDelayKey = 'demoUsers' | 'userById' | 'userGameCards';

export interface ConfigEntry {
  routePrefix: string;
  demoUsersDelayMs: number;
  userByIdDelayMs: number;
  userGameCardsDelayMs: number;
}

interface DemoUsersRouteConfig {
  defaultDemoUsersDelayMs: number;
  defaultUserByIdDelayMs: number;
  defaultUserGameCardsDelayMs: number;
  entries: ConfigEntry[];
}

const ROUTE_CONFIG: DemoUsersRouteConfig = {
  defaultDemoUsersDelayMs: 300,
  defaultUserByIdDelayMs: 300,
  defaultUserGameCardsDelayMs: 300,
  entries: [
    {
      routePrefix: '/game',
      demoUsersDelayMs: 0,
      userByIdDelayMs: 0,
      userGameCardsDelayMs: 1500
    }
  ]
};

export function resolveAdditionalDelayMsForRoute(url: string, key: DemoUsersDelayKey): number {
  const normalizedUrl = normalizeRouteUrl(url);
  let bestMatchLength = -1;
  let selectedEntry: ConfigEntry | null = null;

  for (const entry of ROUTE_CONFIG.entries) {
    const normalizedPrefix = normalizeRouteUrl(entry.routePrefix);
    if (!isRoutePrefixMatch(normalizedUrl, normalizedPrefix)) {
      continue;
    }
    if (normalizedPrefix.length <= bestMatchLength) {
      continue;
    }
    bestMatchLength = normalizedPrefix.length;
    selectedEntry = entry;
  }

  let selectedDelayMs: number;
  switch (key) {
    case 'demoUsers':
      selectedDelayMs = selectedEntry?.demoUsersDelayMs ?? ROUTE_CONFIG.defaultDemoUsersDelayMs;
      break;
    case 'userById':
      selectedDelayMs = selectedEntry?.userByIdDelayMs ?? ROUTE_CONFIG.defaultUserByIdDelayMs;
      break;
    case 'userGameCards':
    default:
      selectedDelayMs = selectedEntry?.userGameCardsDelayMs ?? ROUTE_CONFIG.defaultUserGameCardsDelayMs;
      break;
  }

  return normalizeDelayMs(selectedDelayMs);
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

function normalizeDelayMs(value: number): number {
  return Math.max(0, Math.trunc(value));
}
