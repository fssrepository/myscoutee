import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { OperatorEmailSave } from '@fssrepository/myscoutee-base/email/contracts';
@Injectable({ providedIn: 'root' })
export class OperatorEmailService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.OPERATOR_EMAIL);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.OPERATOR_EMAIL);
  private get source() { return this.resolveRouteService('/operator/email-configuration', this.local, this.http); }
  load() { return this.source.load(); }
  save(request: OperatorEmailSave) { return this.source.save(request); }
}
