import { environment } from '../../../../environments/environment';
import type { AuthMode } from './constants';

export function isFirebaseLoginEnabled(): boolean {
  return environment.firebaseLoginEnabled;
}

export function resolveRuntimeAuthMode(
  loginCapabilityEnabled: boolean,
  firebaseRuntimeAvailable: boolean
): AuthMode {
  return loginCapabilityEnabled && firebaseRuntimeAvailable
    ? 'firebase'
    : 'selector';
}
