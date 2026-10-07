import { Injectable, inject } from '@angular/core';
import type { NotificationCategory } from '../../../contracts/notification.interface';
import type { UserDto } from '../../../contracts/user.interface';
import templates from '../../seed/data/role-notifications.json';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalUsersRepository } from '../repositories/users.repository';

@Injectable({ providedIn: 'root' })
export class LocalRoleNotificationsService {
  private readonly users = inject(LocalUsersRepository);
  private readonly notifications = inject(LocalNotificationsRepository);

  async memberJoined(previous: { profileStatus?: string | null } | null, user: UserDto): Promise<void> {
    const record = this.users.queryUserById(user.id);
    if ((!previous || previous.profileStatus === 'onboarding') && user.profileStatus !== 'onboarding'
      && !user.admin && !user.operator && !record?.workspaceGroupId && !record?.accountUserId) {
      await this.publish('node-member-joined', user.id);
    }
  }

  async publish(kind: string, eventId: string, parameters: Record<string, string> = {}): Promise<void> {
    await this.users.whenReady();
    const definitions = templates.filter(item => item.kind === kind);
    const records = definitions.flatMap(({ role, ...item }) => {
      // The existing selector owns role eligibility; no separate role registry or timer.
      const recipients = this.users.queryAvailableDemoUsers(role === 'operator' ? 'operator' : 'admin');
      const payload = Object.fromEntries(Object.entries({ ...item.payload, ...parameters })
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
      const { demo: _demo, seedVersion: _seedVersion, ...eventPayload } = payload;
      return recipients.map(user => ({ ...item, category: item.category as NotificationCategory,
        id: `role:${kind}:${eventId}:${user.id}`, recipientUserId: user.id, sourceId: eventId,
        createdAtIso: new Date().toISOString(), readAtIso: null, payload: eventPayload }));
    });
    this.notifications.append(records);
    await this.notifications.flushToIndexedDb();
  }
}
