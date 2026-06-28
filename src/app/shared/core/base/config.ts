export interface RouteConfigEntry {
  routePrefix: string;
  demoDelayMs?: number;
  requestTimeoutMs?: number;
  intervalMs?: number;
  demoIntervalMs?: number;
  mode?: RouteMode | null;
  http?: boolean;
}

export type RouteMode = 'local' | 'http';

export interface RouteConfig {
  defaultDemoDelayMs: number;
  defaultRequestTimeoutMs: number;
  defaultIntervalMs: number;
  entries: RouteConfigEntry[];
}

export interface ResolvedRouteConfig {
  routePrefix: string;
  demoDelayMs: number;
  requestTimeoutMs: number;
  intervalMs: number;
  demoIntervalMs: number;
  mode: RouteMode | null;
  http: boolean;
}

export const ROUTE_CONFIG: RouteConfig = {
  defaultDemoDelayMs: 1500,
  defaultRequestTimeoutMs: 3000,
  defaultIntervalMs: 0,
  entries: [
    {
      routePrefix: '/auth/demo-users',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/auth/me',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/auth/me/onboarding-draft-autosave',
      intervalMs: 30000
    },
    {
      routePrefix: '/auth/me/feedback',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/auth/me/experiences',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/auth/me/preferences',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/auth/me/report-user',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/auth/me/realtime/long-poll',
      demoDelayMs: 0,
      intervalMs: 30000,
      demoIntervalMs: 10000
    },
    {
      routePrefix: '/local/users/realtime/long-poll',
      demoDelayMs: 0,
      intervalMs: 30000,
      demoIntervalMs: 10000
    },
    {
      routePrefix: '/auth/me/logout',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/auth/me/delete',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/help',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/help/active',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/privacy',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/privacy/active',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/privacy/consents',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/terms',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/terms/active',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/explanation',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/explanation/active',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/landing/content',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/help',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/help/revisions',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/privacy',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/privacy/revisions',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/explanation',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/explanation/revisions',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/ideas',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/reports',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/reports/blocked-users',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/reports/warn',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/reports/block',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/reports/unblock',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/feedback',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/notifications',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/notifications/save',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/notifications/run',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/params',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/params/save',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/params/history',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/params/revert',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/stats',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/affinity-graph',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/admin/monitoring',
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
      routePrefix: '/activities/events/draft-autosave',
      intervalMs: 5000
    },
    {
      routePrefix: '/activities/events/explore',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/events/checkout',
      demoDelayMs: 1500
    },
    {
      routePrefix: '/activities/events/feedback',
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
      routePrefix: '/media/images/import',
      demoDelayMs: 1500,
      requestTimeoutMs: 15000
    },
    {
      routePrefix: '/media/images',
      demoDelayMs: 1500,
      requestTimeoutMs: 15000
    },
    {
      routePrefix: '/media/audio',
      demoDelayMs: 1500,
      requestTimeoutMs: 20000
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
  const configuredMode = normalizeRouteMode(entry?.mode ?? null);
  return {
    routePrefix: entry?.routePrefix ?? normalizedUrl,
    demoDelayMs: normalizeDelayMs(entry?.demoDelayMs ?? ROUTE_CONFIG.defaultDemoDelayMs),
    requestTimeoutMs: normalizeDelayMs(entry?.requestTimeoutMs ?? ROUTE_CONFIG.defaultRequestTimeoutMs),
    intervalMs: normalizeDelayMs(entry?.intervalMs ?? ROUTE_CONFIG.defaultIntervalMs),
    demoIntervalMs: normalizeDelayMs(entry?.demoIntervalMs ?? ROUTE_CONFIG.defaultIntervalMs),
    mode: configuredMode,
    http: entry?.http === true || configuredMode === 'http'
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

function normalizeRouteMode(value: RouteMode | null | undefined): RouteMode | null {
  return value === 'local' || value === 'http' ? value : null;
}
