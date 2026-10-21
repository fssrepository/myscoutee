import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { DEVICE_REGISTRATIONS_ROUTE, type DeviceRegistrationDto, type DeviceRegistrationRemovalDto } from '../../../contracts/accounts/device-registration.interface';

import { BaseRouteModeService } from '../platform/base-route-mode.service';

@Injectable({ providedIn: 'root' })
export class DeviceRegistrationsService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.DEVICE_REGISTRATIONS);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.DEVICE_REGISTRATIONS);

  get isLocal(): boolean { return this.isLocalRouteEnabled(DEVICE_REGISTRATIONS_ROUTE); }

  upsert(request: DeviceRegistrationDto): Promise<void> {
    return this.adapter.upsert(request);
  }

  remove(request: DeviceRegistrationRemovalDto): Promise<void> {
    return this.adapter.remove(request);
  }

  private get adapter(): AdapterInstance<typeof LOCAL_ADAPTER.DEVICE_REGISTRATIONS> | AdapterInstance<typeof HTTP_ADAPTER.DEVICE_REGISTRATIONS> {
    return this.resolveRouteService(DEVICE_REGISTRATIONS_ROUTE, this.local, this.http);
  }
}
