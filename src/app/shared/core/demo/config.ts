export interface ConfigEntry {
  routePrefix: string;
  demoDelayMs: number;
}

interface DemoUsersRouteConfig {
  defaultDemoDelayMs: number;
  entries: ConfigEntry[];
}

const ROUTE_CONFIG: DemoUsersRouteConfig = {
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
    }
  ]
};

export function resolveAdditionalDelayMsForRoute(url: string): number {
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

  return normalizeDelayMs(selectedEntry?.demoDelayMs ?? ROUTE_CONFIG.defaultDemoDelayMs);
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
