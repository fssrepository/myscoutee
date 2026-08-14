export const environment = {
  production: false,
  activitiesDataSource: 'http' as 'local' | 'http',
  operatorRegistryDataSource: 'http' as 'local' | 'http' | 'session',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: false,
  firebaseLoginEnabled: false,
  firebaseLoginQaOverrideEnabled: false,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: false
};
