import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { IFollowingService } from '../../../contracts/accounts/following.interface';
const FOLLOWING_ROUTE = '/activities/events';
@Injectable({ providedIn: 'root' })
export class FollowingService extends BaseRouteModeService implements IFollowingService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.FOLLOWING);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.FOLLOWING);
  constructor() {
    super();
    // The selected adapter starts the existing expiry effect when this owner
    // is constructed, including before the first change/members request.
    this.transportAdapters.getLoaded(this.resolveRouteService(
      FOLLOWING_ROUTE, LOCAL_ADAPTER.FOLLOWING, HTTP_ADAPTER.FOLLOWING));
  }
  private get source(): IFollowingService {
    return this.resolveRouteService(FOLLOWING_ROUTE, this.local, this.http);
  }
  change(userId: string, organizerId: string, followed: boolean) {
    return this.source.change(userId, organizerId, followed);
  }
  members(userId: string) { return this.source.members(userId); }
}
