import { Injectable, inject } from '@angular/core';
import { DEVICE_REGISTRATIONS_ROUTE, type DeviceRegistrationDto, type DeviceRegistrationRemovalDto } from '../../contracts/device-registration.interface';
import { LocalDeviceRegistrationsService } from '../../local/source/services/device-registrations.service';
import { HttpDeviceRegistrationsService } from '../../http/services/device-registrations.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({ providedIn: 'root' })
export class DeviceRegistrationsService extends BaseRouteModeService {
  private readonly local = inject(LocalDeviceRegistrationsService);
  private readonly http = inject(HttpDeviceRegistrationsService);

  get isLocal(): boolean { return this.isLocalRouteEnabled(DEVICE_REGISTRATIONS_ROUTE); }

  upsert(request: DeviceRegistrationDto): Promise<void> {
    return this.adapter.upsert(request);
  }

  remove(request: DeviceRegistrationRemovalDto): Promise<void> {
    return this.adapter.remove(request);
  }

  private get adapter(): LocalDeviceRegistrationsService | HttpDeviceRegistrationsService {
    return this.resolveRouteService(DEVICE_REGISTRATIONS_ROUTE, this.local, this.http);
  }
}
