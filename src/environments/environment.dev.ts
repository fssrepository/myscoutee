export const environment = {
  production: false,
  activitiesDataSource: 'http' as 'local' | 'http',
  operatorRegistryDataSource: 'http' as 'local' | 'http' | 'session',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: false,
  firebaseLoginEnabled: false,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: false
};
