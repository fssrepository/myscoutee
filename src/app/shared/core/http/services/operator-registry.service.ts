import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  OperatorRegistryConfirmRequestDto,
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryServiceContract,
  OperatorRegistryStatusDto
} from '../../contracts/operator.interface';
import { SessionService } from '../../base/services/session.service';
import { RouteDelayService } from '../../base/services/route-delay.service';

const OPERATOR_REGISTRY_ROUTE = '/operator/registry';
const DEMO_OPERATOR_USER_HEADER = 'X-Demo-User-Id';

@Injectable({
  providedIn: 'root'
})
export class HttpOperatorRegistryService implements OperatorRegistryServiceContract {
  readonly source = 'http' as const;
  private readonly http = inject(HttpClient);
  private readonly sessionService = inject(SessionService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = (environment.apiBaseUrl ?? '/api').replace(/\/+$/, '');
  private readonly endpoint = `${this.apiBaseUrl}${OPERATOR_REGISTRY_ROUTE}`;

  async loadStatus(): Promise<OperatorRegistryStatusDto> {
    return await this.requireResponse(
      OPERATOR_REGISTRY_ROUTE,
      this.http.get<OperatorRegistryStatusDto>(this.endpoint, this.requestOptions()).toPromise()
    );
  }

  async inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto> {
    const payload: OperatorRegistryInspectRequestDto = {
      baseUrl: request.baseUrl.trim(),
      ...(request.expectedScope?.trim() ? { expectedScope: request.expectedScope.trim() } : {})
    };
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/inspect`,
      this.http.post<OperatorRegistryInspectionDto>(
        `${this.endpoint}/inspect`,
        payload,
        this.requestOptions()
      ).toPromise()
    );
  }

  async confirm(inspectionToken: string): Promise<OperatorRegistryStatusDto> {
    const payload: OperatorRegistryConfirmRequestDto = {
      inspectionToken: inspectionToken.trim()
    };
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/confirm`,
      this.http.post<OperatorRegistryStatusDto>(
        `${this.endpoint}/confirm`,
        payload,
        this.requestOptions()
      ).toPromise()
    );
  }

  async retry(): Promise<OperatorRegistryStatusDto> {
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/retry`,
      this.http.post<OperatorRegistryStatusDto>(
        `${this.endpoint}/retry`,
        null,
        this.requestOptions()
      ).toPromise()
    );
  }

  async disconnect(): Promise<OperatorRegistryStatusDto> {
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/disconnect`,
      this.http.post<OperatorRegistryStatusDto>(
        `${this.endpoint}/disconnect`,
        null,
        this.requestOptions()
      ).toPromise()
    );
  }

  private requestOptions(): { headers?: HttpHeaders } {
    const session = this.sessionService.currentSession();
    if (session?.kind !== 'demo') {
      return {};
    }
    return {
      headers: new HttpHeaders({
        [DEMO_OPERATOR_USER_HEADER]: session.userId.trim()
      })
    };
  }

  private async requireResponse<T>(route: string, task: Promise<T | undefined>): Promise<T> {
    const response = await this.routeDelay.withRequestTimeout(
      route,
      task,
      'Operator registry request timed out.'
    );
    if (!response) {
      throw new Error('Operator registry response is unavailable.');
    }
    return response;
  }
}
