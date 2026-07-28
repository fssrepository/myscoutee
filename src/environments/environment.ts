export const environment = {
  production: false,
  activitiesDataSource: 'local' as 'local' | 'http',
  operatorRegistryDataSource: 'local' as 'local' | 'http' | 'session',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: false,
  firebaseLoginEnabled: false,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: false
};
