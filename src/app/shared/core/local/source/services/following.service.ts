import { Injectable, effect, inject, untracked } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import type { FollowingState, IFollowingService } from '../../../contracts/following.interface';
import type { ActivityMemberDTO } from '../../../contracts/activity.interface';
@Injectable({ providedIn: 'root' })
export class LocalFollowingService implements IFollowingService {
  private readonly db = inject(LocalMemoryDb);
  private expiryTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => {
      const dates = Object.values(this.db.read()[USERS_TABLE_NAME].byId)
        .map(user => Date.parse(user.following?.nextExpiryAtIso ?? '')).filter(Number.isFinite);
      clearTimeout(this.expiryTimer);
      if (dates.length) this.expiryTimer = setTimeout(() => untracked(() => this.db.write(state => state)),
        Math.min(2147483647, Math.max(1, Math.min(...dates) - Date.now() + 1)));
    });
  }
  async change(userId: string, organizerId: string, followed: boolean): Promise<FollowingState> {
    await this.db.whenReady();
    const users = this.db.read()[USERS_TABLE_NAME];
    if (userId === organizerId || !users.byId[userId] || (followed && !users.byId[organizerId])) throw new Error('Invalid organizer');
    this.db.write(state => {
      const table = state[USERS_TABLE_NAME];
      const user = table.byId[userId];
      const ids = new Set(user.following?.organizerIds ?? []);
      if (followed) ids.add(organizerId); else ids.delete(organizerId);
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId: { ...table.byId,
        [userId]: { ...user, following: { organizerIds: [...ids], eventCount: 0 } } } } };
    });
    return this.db.read()[USERS_TABLE_NAME].byId[userId].following!;
  }
  async members(userId: string): Promise<ActivityMemberDTO[]> {
    await this.db.whenReady();
    const users = this.db.read()[USERS_TABLE_NAME];
    return (users.byId[userId]?.following?.organizerIds ?? []).flatMap(id => {
      const user = users.byId[id];
      return user ? [{ id, userId: id, name: user.name, initials: user.initials, gender: user.gender,
        city: user.city, avatarUrl: user.images?.[0] ?? '', statusText: user.statusText, pendingSource: 'admin' as const,
        requestKind: 'invite' as const, invitedByActiveUser: false, metAtIso: '', actionAtIso: '', metWhere: '', role: 'Member' as const, status: 'accepted' as const }] : [];
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
}
