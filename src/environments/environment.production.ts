export const environment = {
  production: true,
  activitiesDataSource: 'http' as 'local' | 'http',
  operatorRegistryDataSource: 'session' as 'local' | 'http' | 'session',
  bootstrapOffsetInDays: 0,
  apiBaseUrl: '/api',
  serviceWorkerEnabled: true,
  firebaseLoginEnabled: true,
  firebaseLoginQaOverrideEnabled: false,
  firebaseMessagingEnabled: true,
  paymentIntegrationEnabled: true,
  paymentSimulatorConfigUrl: null as string | null
};
