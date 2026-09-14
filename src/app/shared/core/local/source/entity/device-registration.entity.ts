export interface DeviceRegistrationRecord {
  deviceId: string;
  platform: 'web-pwa' | 'web-browser';
  notificationsEnabled: boolean;
  registeredAtIso: string;
  lastSeenAtIso: string;
}
