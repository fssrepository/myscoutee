import { environment } from '../../../../environments/environment';

export function resolveFirebaseLoginEnabled(
  configured: boolean,
  production: boolean,
  qaOverrideAllowed: boolean,
  search: string
): boolean {
  if (configured) {
    return true;
  }
  if (production || !qaOverrideAllowed) {
    return false;
  }
  return new URLSearchParams(search).get('qaAuth') === 'firebase';
}

const firebaseLoginEnabled = resolveFirebaseLoginEnabled(
  environment.firebaseLoginEnabled,
  environment.production,
  environment.firebaseLoginQaOverrideEnabled,
  typeof window === 'undefined' ? '' : window.location.search
);

export function isFirebaseLoginEnabled(): boolean {
  return firebaseLoginEnabled;
}
