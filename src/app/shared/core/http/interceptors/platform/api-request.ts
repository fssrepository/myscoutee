import { environment } from '../../../../../../environments/environment';

const apiBaseUrl = (environment.apiBaseUrl ?? '/api').trim() || '/api';
function apiUrls(url: string): [URL, URL] | null {
  try {
    const origin = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI;
    return [new URL(url, origin), new URL(apiBaseUrl, origin)];
  } catch { return null; }
}
export function isApiRequest(url: string): boolean {
  const pair = apiUrls(url);
  if (!pair) return false;
  const [request, api] = pair;
  const base = api.pathname.replace(/\/+$/, '');
  return request.origin === api.origin && (request.pathname === base || request.pathname.startsWith(`${base}/`));
}
export function isSessionLoginRequest(url: string): boolean {
  const pair = apiUrls(url);
  return !!pair && isApiRequest(url)
    && pair[0].pathname === `${pair[1].pathname.replace(/\/+$/, '')}/auth/session/login`;
}
