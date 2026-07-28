export const environment = {
  production: true,
  activitiesDataSource: 'http' as 'local' | 'http',
  operatorRegistryDataSource: 'session' as 'local' | 'http' | 'session',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: true,
  firebaseLoginEnabled: true,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: false
};
