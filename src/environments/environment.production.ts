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
  paymentSimulatorConfigUrl: '/api/admin/payment-simulator/configuration-access' as string | null
};
