import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { GlobalIdentityMapper } from '../../base/mappers/global-identity.mapper';
import { RouteDelayService } from '../../base/services/route-delay.service';
import type {
  GlobalIdentityConsentRequestDto,
  GlobalIdentityServiceContract,
  GlobalIdentityStatusDto,
  GlobalIdentityUnlinkRequestDto
} from '../../contracts/global-identity.interface';

const GLOBAL_IDENTITY_ROUTE = '/auth/me/global-identity';

@Injectable({
  providedIn: 'root'
})
export class HttpGlobalIdentityService
implements GlobalIdentityServiceContract {
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = (environment.apiBaseUrl ?? '/api')
    .replace(/\/+$/, '');

  async loadStatus(): Promise<GlobalIdentityStatusDto> {
    return this.request(
      this.http
        .get<GlobalIdentityStatusDto>(
          `${this.apiBaseUrl}${GLOBAL_IDENTITY_ROUTE}`
        )
        .toPromise()
    );
  }

  async link(
    request: GlobalIdentityConsentRequestDto
  ): Promise<GlobalIdentityStatusDto> {
    return this.request(
      this.http
        .post<GlobalIdentityStatusDto>(
          `${this.apiBaseUrl}${GLOBAL_IDENTITY_ROUTE}`,
          request
        )
        .toPromise()
    );
  }

  async rotate(): Promise<GlobalIdentityStatusDto> {
    return this.request(
      this.http
        .post<GlobalIdentityStatusDto>(
          `${this.apiBaseUrl}${GLOBAL_IDENTITY_ROUTE}/rotate`,
          {}
        )
        .toPromise()
    );
  }

  async unlink(
    request: GlobalIdentityUnlinkRequestDto
  ): Promise<GlobalIdentityStatusDto> {
    return this.request(
      this.http
        .post<GlobalIdentityStatusDto>(
          `${this.apiBaseUrl}${GLOBAL_IDENTITY_ROUTE}/unlink`,
          request
        )
        .toPromise()
    );
  }

  private async request(
    task: Promise<GlobalIdentityStatusDto | undefined>
  ): Promise<GlobalIdentityStatusDto> {
    const response = await this.routeDelay.withRequestTimeout(
      GLOBAL_IDENTITY_ROUTE,
      task,
      'global.identity.error.timeout',
      30_000
    );
    return GlobalIdentityMapper.toStatusDto(response);
  }
}
