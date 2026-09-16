import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { DEVICE_REGISTRATIONS_ROUTE, type DeviceRegistrationDto, type DeviceRegistrationRemovalDto } from '../../contracts/device-registration.interface';

@Injectable({ providedIn: 'root' })
export class HttpDeviceRegistrationsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}${DEVICE_REGISTRATIONS_ROUTE}`;

  async upsert(request: DeviceRegistrationDto): Promise<void> {
    await firstValueFrom(this.http.post(this.url, request).pipe(timeout(3_000)));
  }

  async remove(request: DeviceRegistrationRemovalDto): Promise<void> {
    await firstValueFrom(this.http.request('delete', this.url, { body: request }).pipe(timeout(3_000)));
  }
}
