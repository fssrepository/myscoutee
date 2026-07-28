export const environment = {
  production: true,
  activitiesDataSource: 'local' as 'local' | 'http',
  operatorRegistryDataSource: 'local' as 'local' | 'http' | 'session',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: true,
  firebaseLoginEnabled: false,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: false
};
