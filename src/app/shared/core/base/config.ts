export interface RouteConfigEntry {
  routePrefix: string;
  demoDelayMs: number;
  http?: boolean;
}

export interface RouteConfig {
  defaultDemoDelayMs: number;
  entries: RouteConfigEntry[];
}

export interface ResolvedRouteConfig {
  routePrefix: string;
  demoDelayMs: number;
  http: boolean;
}

export const ROUTE_CONFIG: RouteConfig = {
  defaultDemoDelayMs: 300,
  entries: [
    {
      routePrefix: '/auth/demo-users',
      demoDelayMs: 0
    },
    {
      routePrefix: '/auth/me',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/game-cards/query',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/chats',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/events',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/events/subevent-resources',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/events/members',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/events/invite-candidates',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/rates',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/assets',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/assets/tickets',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/navigator/contacts',
      demoDelayMs: 1500
    }
  ]
};

export function resolveRouteConfigEntry(url: string): RouteConfigEntry | null {
  const normalizedUrl = normalizeRouteUrl(url);
  let bestMatchLength = -1;
  let selectedEntry: RouteConfigEntry | null = null;

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

  return selectedEntry;
}

export function resolveRouteConfig(url: string): ResolvedRouteConfig {
  const normalizedUrl = normalizeRouteUrl(url);
  const entry = resolveRouteConfigEntry(normalizedUrl);
  return {
    routePrefix: entry?.routePrefix ?? normalizedUrl,
    demoDelayMs: normalizeDelayMs(entry?.demoDelayMs ?? ROUTE_CONFIG.defaultDemoDelayMs),
    http: entry?.http === true
  };
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
