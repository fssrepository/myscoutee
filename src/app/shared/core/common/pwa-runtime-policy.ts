export interface PwaNotificationRuntimePolicyInput {
  activitiesDataSource: 'local' | 'http';
  firebaseMessagingEnabled: boolean;
  serviceWorkerEnabled: boolean;
}

export function pwaNotificationRegistrationEnabled(input: PwaNotificationRuntimePolicyInput): boolean {
  return input.activitiesDataSource === 'http'
    && input.firebaseMessagingEnabled && input.serviceWorkerEnabled;
}
