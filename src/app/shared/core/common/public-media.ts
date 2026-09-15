// Keep aligned with the server's MediaAccessPaths; private/legacy uploads never enter a shared cache.
export function isPublicMediaUrl(url: URL): boolean {
  if (!['/media/public', '/api/media/public'].includes(url.pathname)) return false;
  const key = url.searchParams.get('key') ?? '';
  return key.length <= 2048 && !key.includes('\\') && !/[\x00-\x1f\x7f]/.test(key)
    && key.split('/').every(part => part !== '' && part !== '.' && part !== '..')
    && ['public/demo/', 'public/branding/', 'images/demo-profiles/', 'images/demo-assets/',
      'images/demo-events/', 'images/system/', 'payment-cards/'].some(prefix => key.startsWith(prefix));
}
