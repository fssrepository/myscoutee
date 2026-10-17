import DOMPurify from 'dompurify';

export function sanitizeHtml(value: string | null | undefined): string {
  if (typeof document === 'undefined') return '';
  return DOMPurify.sanitize(`${value ?? ''}`, { USE_PROFILES: { html: true } }).trim();
}
