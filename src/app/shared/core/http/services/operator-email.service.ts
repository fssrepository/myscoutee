import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { OperatorEmailConfiguration, OperatorEmailSave } from '../../contracts/operator-email.interface';
@Injectable({ providedIn: 'root' })
export class HttpOperatorEmailService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/operator/email-configuration`;
  load() { return firstValueFrom(this.http.get<OperatorEmailConfiguration>(this.url)); }
  save(request: OperatorEmailSave) { return firstValueFrom(this.http.put<OperatorEmailConfiguration>(this.url, request)); }
}
