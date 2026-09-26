import type { ContactChatAccessAction, ContactChatAccessSnapshot } from '../../../contracts/contact.interface';
import { Injectable, inject } from '@angular/core';

import type { StoredContact } from '../../../contracts/contact.interface';
import type { ProfileViewData } from '../../../contracts/profile.interface';
import { LocalContactsMapper, LocalProfileExperiencesMapper, LocalUsersMapper } from '../mappers';
import { LocalContactsRepository } from '../repositories/contacts.repository';
import { LocalProfileExperiencesRepository } from '../repositories/profile-experiences.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalRouteDelayService } from './route-delay.service';
import { SessionService } from '../../../base/services/session.service';
import { UserProfileState } from '../../../common/user-profile-state';

@Injectable({
  providedIn: 'root'
})
export class LocalContactsService extends LocalRouteDelayService {
  private static readonly CONTACTS_ROUTE = '/navigator/contacts';
  private readonly contactsRepository = inject(LocalContactsRepository);
  private readonly profileExperiencesRepository = inject(LocalProfileExperiencesRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly sessionService = inject(SessionService);

  async loadChatAccess(): Promise<ContactChatAccessSnapshot> {
    const actor = this.sessionService.activeUserId();
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    if (!actor || actor !== this.sessionService.activeUserId()) throw new Error('Contact session changed.');
    return this.chatAccessSnapshot(actor);
  }

  async changeChatAccess(userId: string, action: ContactChatAccessAction, version?: number): Promise<ContactChatAccessSnapshot> {
    const actor = this.sessionService.activeUserId();
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    if (!actor || actor !== this.sessionService.activeUserId()) throw new Error('Contact session changed.');
    this.contactsRepository.changeChatAccess(actor, userId, action, version);
    await this.contactsRepository.flushToIndexedDb();
    return this.chatAccessSnapshot(actor);
  }

  private chatAccessSnapshot(actor: string): ContactChatAccessSnapshot {
    return { records: this.contactsRepository.queryChatAccess(actor),
      contacts: this.contactsRepository.queryContactRecordsByUser(actor),
      pendingCount: this.usersRepository.queryUserById(actor)?.activities.contactRequestsPending ?? 0 };
  }

  async loadContacts(userId: string): Promise<StoredContact[]> {
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    return LocalContactsMapper.cloneContacts(this.contactsRepository.queryContactRecordsByUser(userId));
  }

  async loadContactProfile(userId: string): Promise<ProfileViewData> {
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return this.emptyProfileViewData();
    }
    const record = this.usersRepository.queryUserById(normalizedUserId);
    const user = record ? LocalUsersMapper.toDto(record) : null;
    const viewer = this.sessionService.activeUserId();
    const owner = normalizedUserId === viewer;
    const friend = !!viewer && !owner && UserProfileState.isFriendOfActiveUser(normalizedUserId, viewer);
    const hidden = new Set<string>();
    if (user) {
      user.profileDetails = (user.profileDetails ?? []).map(group => ({
        ...group,
        rows: group.rows.filter(row => {
          const selectable = row.labelKey.startsWith('profile.details.')
            || ['profile.profession', 'profile.experience.workplace', 'profile.experience.school'].includes(row.labelKey);
          const visible = !selectable || owner || row.privacy === 'Public' || (friend && row.privacy === 'Friends');
          if (!visible) hidden.add(row.labelKey);
          return visible;
        })
      }));
    }
    return {
      user,
      experiences: LocalProfileExperiencesMapper.cloneEntries(
        this.profileExperiencesRepository.queryUserExperienceRecords(normalizedUserId)
      ).filter(entry => !(entry.type === 'Workspace' && hidden.has('profile.experience.workplace')))
        .filter(entry => !(entry.type === 'School' && hidden.has('profile.experience.school'))),
      hiddenFields: [...hidden]
    };
  }

  async saveContacts(
    userId: string,
    contacts: readonly StoredContact[]
  ): Promise<StoredContact[]> {
    const savedContacts = this.contactsRepository.replaceContactRecordsForUser(
      userId,
      LocalContactsMapper.toStoredContacts(contacts)
    );
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    return LocalContactsMapper.cloneContacts(savedContacts);
  }

  async deleteContact(userId: string, contactId: string): Promise<StoredContact[]> {
    const savedContacts = this.contactsRepository.deleteContactRecord(userId, contactId);
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    return LocalContactsMapper.cloneContacts(savedContacts);
  }

  private emptyProfileViewData(): ProfileViewData {
    return {
      user: null,
      experiences: []
    };
  }

}
