const REGISTRY_ORIGIN_PATTERN = /^https?:\/\/[^/?#]+\/?$/i;
const REGISTRY_SCOPE_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/;

export function normalizeOperatorRegistryBaseUrl(
  value: string,
  requireHttps: boolean
): string {
  const candidate = `${value ?? ''}`.trim();
  const validationError = validateOperatorRegistryBaseUrl(candidate, requireHttps);
  if (validationError) {
    throw new Error(validationError);
  }
  return new URL(candidate).origin;
}

export function validateOperatorRegistryBaseUrl(
  value: string,
  requireHttps: boolean
): string {
  const candidate = `${value ?? ''}`.trim();
  if (!candidate) {
    return 'operator.registration.error.url.required';
  }
  if (/[\r\n\t]/.test(candidate) || !REGISTRY_ORIGIN_PATTERN.test(candidate)) {
    return 'operator.registration.error.url.origin';
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'operator.registration.error.url.protocol';
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
      return 'operator.registration.error.url.credentials';
    }
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return 'operator.registration.error.url.origin';
    }
    if (requireHttps && parsed.protocol !== 'https:') {
      return 'operator.registration.error.url.https.required';
    }
  } catch {
    return 'operator.registration.error.url.invalid';
  }
  return '';
}

export function validateOperatorRegistryScope(value: string): string {
  const scope = `${value ?? ''}`.trim();
  if (!scope) {
    return '';
  }
  if (!REGISTRY_SCOPE_PATTERN.test(scope)) {
    return 'operator.registration.error.scope.invalid';
  }
  return '';
}
