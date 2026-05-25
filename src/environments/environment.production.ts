export const environment = {
  production: true,
  activitiesDataSource: 'http' as 'demo' | 'http',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: true,
  firebaseLoginEnabled: true,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: false,
  paymentProvider: 'dummy' as 'dummy' | 'stripe' | 'barion'
};
