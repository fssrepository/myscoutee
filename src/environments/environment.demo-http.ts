export const environment = {
  production: false,
  activitiesDataSource: 'http' as 'demo' | 'http',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: false,
  firebaseLoginEnabled: false,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: false,
  paymentProvider: 'dummy' as 'dummy' | 'stripe' | 'barion'
};
