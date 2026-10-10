import { environment } from '../../../../../environments/environment';

const apiBaseUrl = (environment.apiBaseUrl ?? '/api').trim() || '/api';

// Shared request classification for the existing authentication/access chain.
export function isApiRequest(url: string): boolean {
  if (url.startsWith(apiBaseUrl)) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const absoluteApiBaseUrl = new URL(apiBaseUrl, document.baseURI).toString();
  return url.startsWith(absoluteApiBaseUrl);
}

export function isOperatorBootstrapLoginRequest(url: string): boolean {
  if (!isApiRequest(url)) {
    return false;
  }
  const normalizedApiBase = apiBaseUrl.replace(/\/+$/, '');
  if (url === `${normalizedApiBase}/auth/operator-bootstrap`) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const absoluteApiBaseUrl = new URL(
    normalizedApiBase,
    document.baseURI
  ).toString().replace(/\/+$/, '');
  return url === `${absoluteApiBaseUrl}/auth/operator-bootstrap`;
}

export function isAdminRequest(url: string): boolean {
  if (!isApiRequest(url)) {
    return false;
  }
  const normalizedApiBase = apiBaseUrl.replace(/\/+$/, '');
  if (url.startsWith(`${normalizedApiBase}/admin/`)) {
    return true;
  }
  if (url === `${normalizedApiBase}/admin`) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const absoluteApiBaseUrl = new URL(normalizedApiBase, document.baseURI).toString().replace(/\/+$/, '');
  return url === `${absoluteApiBaseUrl}/admin` || url.startsWith(`${absoluteApiBaseUrl}/admin/`);
}
