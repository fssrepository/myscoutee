import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';
import { HttpOperatorEmailService } from '../../../http/services/email/operator-email.service';
import { LocalOperatorEmailService } from '../../../local/source/services/email/operator-email.service';
import type { OperatorEmailSave } from '../../../contracts/email/operator-email.interface';
@Injectable({ providedIn: 'root' })
export class OperatorEmailService extends BaseRouteModeService {
  private readonly http = inject(HttpOperatorEmailService);
  private readonly local = inject(LocalOperatorEmailService);
  private get source() { return this.resolveRouteService('/operator/email-configuration', this.local, this.http); }
  load() { return this.source.load(); }
  save(request: OperatorEmailSave) { return this.source.save(request); }
}
