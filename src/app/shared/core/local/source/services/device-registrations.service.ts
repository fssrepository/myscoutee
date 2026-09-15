import { Injectable, inject } from '@angular/core';
import { DEVICE_REGISTRATIONS_ROUTE, type DeviceRegistrationDto, type DeviceRegistrationRemovalDto } from '../../../contracts/device-registration.interface';
import { LocalDeviceRegistrationsRepository } from '../repositories/device-registrations.repository';
import { LocalRouteDelayService } from './route-delay.service';

@Injectable({ providedIn: 'root' })
export class LocalDeviceRegistrationsService extends LocalRouteDelayService {
  private readonly repository = inject(LocalDeviceRegistrationsRepository);

  async upsert(request: DeviceRegistrationDto): Promise<void> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(DEVICE_REGISTRATIONS_ROUTE);
    this.repository.upsert(request);
    await this.repository.flushToIndexedDb();
  }

  async remove(request: DeviceRegistrationRemovalDto): Promise<void> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(DEVICE_REGISTRATIONS_ROUTE);
    this.repository.remove(request);
    await this.repository.flushToIndexedDb();
  }
}
