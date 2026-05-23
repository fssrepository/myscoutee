export const environment = {
  production: true,
  loginEnabled: false,
  activitiesDataSource: 'demo' as 'demo' | 'http',
  demoBootstrapEnabled: true,
  demoSeedScheduleAnchorDateIso: null as string | null,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: true,
  firebaseMessagingEnabled: true,
  assetSourceRefreshEnabled: true,
  paymentIntegrationEnabled: false,
  paymentProvider: 'dummy' as 'dummy' | 'stripe' | 'barion'
};
