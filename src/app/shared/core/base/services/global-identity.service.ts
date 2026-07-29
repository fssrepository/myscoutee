import { Injectable, inject } from '@angular/core';

import { HttpGlobalIdentityService } from '../../http/services/global-identity.service';
import { LocalGlobalIdentityService } from '../../local/source/services/global-identity.service';
import type {
  GlobalIdentityConsentRequestDto,
  GlobalIdentityServiceContract,
  GlobalIdentityStatusDto,
  GlobalIdentityUnlinkRequestDto
} from '../../contracts/global-identity.interface';
import { BaseRouteModeService } from './base-route-mode.service';

const GLOBAL_IDENTITY_ROUTE = '/auth/me/global-identity';

@Injectable({
  providedIn: 'root'
})
export class GlobalIdentityService extends BaseRouteModeService
implements GlobalIdentityServiceContract {
  private readonly localService = inject(LocalGlobalIdentityService);
  private readonly httpService = inject(HttpGlobalIdentityService);

  loadStatus(): Promise<GlobalIdentityStatusDto> {
    return this.service.loadStatus();
  }

  link(
    request: GlobalIdentityConsentRequestDto
  ): Promise<GlobalIdentityStatusDto> {
    return this.service.link(request);
  }

  rotate(): Promise<GlobalIdentityStatusDto> {
    return this.service.rotate();
  }

  unlink(
    request: GlobalIdentityUnlinkRequestDto
  ): Promise<GlobalIdentityStatusDto> {
    return this.service.unlink(request);
  }

  private get service(): GlobalIdentityServiceContract {
    return this.resolveRouteService(
      GLOBAL_IDENTITY_ROUTE,
      this.localService,
      this.httpService
    );
  }
}
