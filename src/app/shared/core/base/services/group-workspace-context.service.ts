import { Injectable, computed, signal } from '@angular/core';
import type { GroupWorkspace } from '../../contracts/community-group.interface';
import { groupType } from '../../contracts/group-type';

/** Account authentication stays unchanged when the active profile changes. */
@Injectable({ providedIn: 'root' })
export class GroupWorkspaceContextService {
  readonly accountUserId = signal('');
  readonly active = signal<GroupWorkspace | null>(null);
  readonly groupType = computed(() => groupType(this.active()?.groupType));
  readonly isWork = computed(() => this.groupType() === 'work');
  readonly isCommunity = computed(() => this.groupType() === 'community');
  readonly switching = signal(false);
  readonly revision = signal(0);
  accountId(profileId: string): string {
    return this.active()?.profileId === profileId ? this.accountUserId() : profileId;
  }
}
