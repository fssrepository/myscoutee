export const environment = {
  production: true,
  loginEnabled: true,
  activitiesDataSource: 'http' as 'demo' | 'http',
  demoBootstrapEnabled: false,
  demoSeedScheduleAnchorDateIso: null as string | null,
  apiBaseUrl: '/api',
  remoteI18nEnabled: true,
  serviceWorkerEnabled: true,
  firebaseMessagingEnabled: true,
  assetSourceRefreshEnabled: true,
  paymentIntegrationEnabled: false,
  paymentProvider: 'dummy' as 'dummy' | 'stripe' | 'barion'
};
