import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import type { DeviceRegistrationDto, DeviceRegistrationRemovalDto } from '../../../contracts/device-registration.interface';
import { USERS_TABLE_NAME } from '../entity/user.entity';

@Injectable({ providedIn: 'root' })
export class LocalDeviceRegistrationsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  whenReady(): Promise<void> { return this.memoryDb.whenReady(); }
  flushToIndexedDb(): Promise<void> { return this.memoryDb.flushToIndexedDb(); }

  upsert(request: DeviceRegistrationDto): void {
    this.memoryDb.write(state => {
      const table = state[USERS_TABLE_NAME];
      const user = table.byId[request.userId];
      if (!user || !request.deviceId.trim()) throw new Error('Device registration requires an existing user and device.');
      const now = new Date().toISOString();
      const existing = user.devices?.find(device => device.deviceId === request.deviceId);
      const byId = { ...table.byId };
      // A browser device belongs to its current actor; switching actors removes
      // only this device from the previous local account, in the same write.
      for (const [id, record] of Object.entries(byId)) {
        if (record.devices?.some(device => device.deviceId === request.deviceId)) {
          byId[id] = { ...record, devices: record.devices.filter(device => device.deviceId !== request.deviceId) };
        }
      }
      byId[user.id] = { ...byId[user.id], devices: [...(byId[user.id].devices ?? []), {
        deviceId: request.deviceId,
        platform: request.platform,
        notificationsEnabled: request.notificationsEnabled,
        registeredAtIso: existing?.registeredAtIso ?? now,
        lastSeenAtIso: now
      }] };
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId } };
    });
  }

  remove(request: DeviceRegistrationRemovalDto): void {
    this.memoryDb.write(state => {
      const table = state[USERS_TABLE_NAME];
      const user = table.byId[request.userId];
      if (!user?.devices?.some(device => device.deviceId === request.deviceId)) return state;
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId: { ...table.byId,
        [user.id]: { ...user, devices: user.devices.filter(device => device.deviceId !== request.deviceId) }
      } } };
    });
  }
}
