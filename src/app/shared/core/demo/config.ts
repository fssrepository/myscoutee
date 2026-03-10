export interface ConfigEntry {
  routePrefix: string;
  additionalDelayMs: number;
}

interface DemoUsersRouteConfig {
  defaultAdditionalDelayMs: number;
  entries: ConfigEntry[];
}

const ROUTE_CONFIG: DemoUsersRouteConfig = {
  defaultAdditionalDelayMs: 300,
  entries: [
    {
      routePrefix: '/game',
      additionalDelayMs: 0
    }
  ]
};

export function resolveAdditionalDelayMsForRoute(url: string): number {
  const normalizedUrl = normalizeRouteUrl(url);
  let bestMatchLength = -1;
  let selectedDelayMs = ROUTE_CONFIG.defaultAdditionalDelayMs;

  for (const entry of ROUTE_CONFIG.entries) {
    const normalizedPrefix = normalizeRouteUrl(entry.routePrefix);
    if (!isRoutePrefixMatch(normalizedUrl, normalizedPrefix)) {
      continue;
    }
    if (normalizedPrefix.length <= bestMatchLength) {
      continue;
    }
    bestMatchLength = normalizedPrefix.length;
    selectedDelayMs = entry.additionalDelayMs;
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
