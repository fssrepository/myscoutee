import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';
import { HttpFollowingService } from '../../../http/services/accounts/following.service';
import { LocalFollowingService } from '../../../local/source/services/accounts/following.service';
import type { IFollowingService } from '../../../contracts/accounts/following.interface';
@Injectable({ providedIn: 'root' })
export class FollowingService extends BaseRouteModeService implements IFollowingService {
  private readonly http = inject(HttpFollowingService);
  private readonly local = inject(LocalFollowingService);
  private get source(): IFollowingService {
    return this.resolveRouteService('/activities/events', this.local, this.http);
  }
  change(userId: string, organizerId: string, followed: boolean) {
    return this.source.change(userId, organizerId, followed);
  }
  members(userId: string) { return this.source.members(userId); }
}
