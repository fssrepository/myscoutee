import { AppUtils } from '../../../app-utils';

export function isNavigatorHydrationRoute(routeUrl: string): boolean {
  const path = AppUtils.normalizeRoutePath(routeUrl);
  return path !== '/'
    && !path.startsWith('/entry')
    && !path.startsWith('/admin');
}
