export const environment = {
  production: false,
  loginEnabled: false,
  activitiesDataSource: 'demo' as 'demo' | 'http',
  demoBootstrapEnabled: true,
  demoSeedScheduleAnchorDateIso: null as string | null,
  apiBaseUrl: '/api',
  remoteI18nEnabled: true,
  serviceWorkerEnabled: false,
  firebaseMessagingEnabled: true,
  assetSourceRefreshEnabled: true,
  paymentIntegrationEnabled: false,
  paymentProvider: 'dummy' as 'dummy' | 'stripe' | 'barion'
};
