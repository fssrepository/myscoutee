import { AppUtils } from './app-utils';
export interface RouteConfigEntry {
  routePrefix: string;
  demoDelayMs?: number;
  requestTimeoutMs?: number;
  intervalMs?: number;
  demoIntervalMs?: number;
  mode?: RouteMode | null;
  http?: boolean;
}

export const APP_SETUP_CONFIG = {
  locationRequestTimeoutMs: 10_000
} as const;

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

function demoRoutes(...routePrefixes: string[]): RouteConfigEntry[] {
  return routePrefixes.map(routePrefix => ({ routePrefix, demoDelayMs: 0 }));
}

export const ROUTE_CONFIG: RouteConfig = {
  defaultDemoDelayMs: 0,
  defaultRequestTimeoutMs: 3000,
  defaultIntervalMs: 0,
  entries: [
    {
      routePrefix: '/payment-methods',
      demoDelayMs: 0,
      requestTimeoutMs: 3000
    },
    ...demoRoutes('/auth/demo-users', '/auth/me'),
    {
      routePrefix: '/auth/me/onboarding-draft-autosave',
      intervalMs: 30000
    },
    ...demoRoutes('/auth/me/feedback', '/auth/me/experiences', '/auth/me/preferences', '/auth/me/report-user'),
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
    ...demoRoutes('/auth/me/logout', '/auth/me/delete', '/help', '/help/active', '/privacy', '/privacy/active', '/privacy/consents', '/terms', '/terms/active', '/explanation', '/explanation/active', '/landing/content', '/landing/articles', '/admin', '/admin/help', '/admin/help/revisions', '/admin/privacy', '/admin/privacy/revisions', '/admin/explanation', '/admin/explanation/revisions', '/admin/ideas', '/admin/reports', '/admin/reports/blocked-users', '/admin/reports/warn', '/admin/reports/block', '/admin/reports/unblock', '/admin/feedback', '/admin/notifications', '/admin/notifications/save', '/admin/notifications/run', '/admin/params', '/admin/params/save', '/admin/params/history', '/admin/params/revert', '/admin/stats', '/admin/affinity-graph', '/admin/monitoring'),
    {
      routePrefix: '/operator/registry',
      demoDelayMs: 0,
      requestTimeoutMs: 30000
    },
    {
      routePrefix: '/operator',
      demoDelayMs: 0,
      requestTimeoutMs: 30000
    },
    ...demoRoutes('/game-cards/query', '/activities/chats'),
    {
      routePrefix: '/admin/content-moderation', demoDelayMs: 0, intervalMs: 60000, demoIntervalMs: 60000
    },
    ...demoRoutes('/activities/feed', '/activities/events'),
    {
      routePrefix: '/activities/events/explore',
      demoDelayMs: 0,
      intervalMs: 30000,
      demoIntervalMs: 10000
    },
    {
      routePrefix: '/activities/events/checkout/authorize',
      demoDelayMs: 0,
      requestTimeoutMs: 120000
    },
    {
      routePrefix: '/activities/events/checkout/pay',
      demoDelayMs: 0,
      requestTimeoutMs: 120000
    },
    ...demoRoutes('/activities/events/checkout', '/feedback', '/activities/events/subevent-resources', '/activities/events/members', '/activities/events/invite-candidates', '/activities/rates'),
    {
      routePrefix: '/notifications',
      demoDelayMs: 0,
      intervalMs: 30000,
      demoIntervalMs: 10000
    },
    ...demoRoutes('/assets', '/assets/availability', '/assets/tickets'),
    {
      routePrefix: '/media/images/import',
      demoDelayMs: 0,
      requestTimeoutMs: 15000
    },
    {
      routePrefix: '/media/images',
      demoDelayMs: 0,
      requestTimeoutMs: 15000
    },
    {
      routePrefix: '/media/audio',
      demoDelayMs: 0,
      requestTimeoutMs: 20000
    },
    ...demoRoutes('/navigator/contacts')
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
  return trimmed.startsWith('/') ? AppUtils.trimEndCharacters(trimmed, "/") : AppUtils.trimEndCharacters(`/${trimmed}`, "/");
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
