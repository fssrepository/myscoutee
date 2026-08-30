export interface PwaNotificationRuntimePolicyInput {
  activitiesDataSource: 'local' | 'http';
  firebaseMessagingEnabled: boolean;
  production: boolean;
  hostname: string;
  standalone: boolean;
  devServiceWorkerOverrideEnabled: boolean;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  return normalizedHostname === 'localhost'
    || normalizedHostname === '127.0.0.1'
    || normalizedHostname === '[::1]'
    || normalizedHostname === '::1'
    || normalizedHostname.endsWith('.localhost');
}

export function pwaNotificationRegistrationEnabled(
  input: PwaNotificationRuntimePolicyInput
): boolean {
  if (input.activitiesDataSource !== 'http' || !input.firebaseMessagingEnabled) {
    return false;
  }
  if (!isLoopbackHostname(input.hostname)) {
    return true;
  }
  return !input.production
    && input.standalone
    && input.devServiceWorkerOverrideEnabled;
}
