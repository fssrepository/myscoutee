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
    return 'Enter the registry server URL.';
  }
  if (/[\r\n\t]/.test(candidate) || !REGISTRY_ORIGIN_PATTERN.test(candidate)) {
    return 'Enter an origin-only registry URL without a path, query, or fragment.';
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'The registry URL must use HTTP or HTTPS.';
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
      return 'The registry URL must not contain credentials.';
    }
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return 'Enter an origin-only registry URL without a path, query, or fragment.';
    }
    if (requireHttps && parsed.protocol !== 'https:') {
      return 'Real operator registry connections require HTTPS.';
    }
  } catch {
    return 'Enter a valid absolute registry URL.';
  }
  return '';
}

export function validateOperatorRegistryScope(value: string): string {
  const scope = `${value ?? ''}`.trim();
  if (!scope) {
    return '';
  }
  if (!REGISTRY_SCOPE_PATTERN.test(scope)) {
    return 'The registry scope must be 3–128 lowercase ASCII letters, digits, dots, colons, underscores, or hyphens, and begin with a letter or digit.';
  }
  return '';
}
