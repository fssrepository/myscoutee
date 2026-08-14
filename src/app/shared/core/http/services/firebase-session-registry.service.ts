import {
  HttpBackend,
  HttpClient,
  HttpHeaders
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  UserSessionLoginRequestDto,
  UserSessionLoginResponseDto
} from '../../contracts/user.interface';

@Injectable({
  providedIn: 'root'
})
export class FirebaseSessionRegistryService {
  static readonly SESSION_ID_HEADER = 'X-App-Session-Id';

  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  registerLogin(
    sessionId: string,
    token: string,
    request: UserSessionLoginRequestDto
  ): Promise<UserSessionLoginResponseDto> {
    return firstValueFrom(this.http.post<UserSessionLoginResponseDto>(
      `${this.apiBaseUrl}/auth/session/login`,
      request,
      {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
          [FirebaseSessionRegistryService.SESSION_ID_HEADER]: sessionId
        })
      }
    ));
  }

  registerDemoLogin(
    sessionId: string,
    userId: string,
    request: UserSessionLoginRequestDto
  ): Promise<UserSessionLoginResponseDto> {
    return firstValueFrom(this.http.post<UserSessionLoginResponseDto>(
      `${this.apiBaseUrl}/auth/session/login`,
      request,
      {
        headers: new HttpHeaders({
          [FirebaseSessionRegistryService.SESSION_ID_HEADER]: sessionId,
          'X-App-Session-Kind': 'demo',
          'X-Demo-User-Id': userId
        })
      }
    ));
  }
}
