export const DEVICE_REGISTRATIONS_ROUTE = '/activities/chats/devices';

export interface DeviceRegistrationDto {
  userId: string;
  deviceId: string;
  platform: 'web-pwa' | 'web-browser';
  firebaseToken?: string;
  notificationsEnabled: boolean;
}

export type DeviceRegistrationRemovalDto = Pick<DeviceRegistrationDto, 'userId' | 'deviceId' | 'firebaseToken'>;
