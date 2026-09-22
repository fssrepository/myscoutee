import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { HttpOperatorEmailService } from '../../http/services/operator-email.service';
import { LocalOperatorEmailService } from '../../local/source/services/operator-email.service';
import type { OperatorEmailSave } from '../../contracts/operator-email.interface';
@Injectable({ providedIn: 'root' })
export class OperatorEmailService extends BaseRouteModeService {
  private readonly http = inject(HttpOperatorEmailService);
  private readonly local = inject(LocalOperatorEmailService);
  private get source() { return this.resolveRouteService('/operator/email-configuration', this.local, this.http); }
  load() { return this.source.load(); }
  save(request: OperatorEmailSave) { return this.source.save(request); }
}
