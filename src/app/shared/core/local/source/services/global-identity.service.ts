import { Injectable } from '@angular/core';

import { GlobalIdentityMapper } from '../../../base/mappers/global-identity.mapper';
import type {
  GlobalIdentityConsentRequestDto,
  GlobalIdentityServiceContract,
  GlobalIdentityStatusDto,
  GlobalIdentityUnlinkRequestDto
} from '../../../contracts/global-identity.interface';
import { LocalRouteDelayService } from './route-delay.service';

const GLOBAL_IDENTITY_ROUTE = '/auth/me/global-identity';

/**
 * The explicit browser-only fallback has no trusted deployment key or
 * registry. It therefore reports the capability as unavailable instead of
 * fabricating a network identity.
 */
@Injectable({
  providedIn: 'root'
})
export class LocalGlobalIdentityService
extends LocalRouteDelayService
implements GlobalIdentityServiceContract {
  async loadStatus(): Promise<GlobalIdentityStatusDto> {
    await this.waitForRouteDelay(GLOBAL_IDENTITY_ROUTE);
    return GlobalIdentityMapper.unavailableStatus();
  }

  async link(
    _request: GlobalIdentityConsentRequestDto
  ): Promise<GlobalIdentityStatusDto> {
    return this.unavailable();
  }

  async rotate(): Promise<GlobalIdentityStatusDto> {
    return this.unavailable();
  }

  async unlink(
    _request: GlobalIdentityUnlinkRequestDto
  ): Promise<GlobalIdentityStatusDto> {
    return this.unavailable();
  }

  private async unavailable(): Promise<GlobalIdentityStatusDto> {
    await this.waitForRouteDelay(GLOBAL_IDENTITY_ROUTE);
    throw new Error('global.identity.error.local.unavailable');
  }
}
