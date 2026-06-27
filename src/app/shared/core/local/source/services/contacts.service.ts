import { Injectable, inject } from '@angular/core';

import type { StoredContact } from '../../../contracts/contact.interface';
import type { ProfileViewData } from '../../../contracts/profile.interface';
import { LocalContactsMapper, LocalProfileExperiencesMapper, LocalUsersMapper } from '../mappers';
import { LocalContactsRepository } from '../repositories/contacts.repository';
import { LocalProfileExperiencesRepository } from '../repositories/profile-experiences.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalRouteDelayService } from './route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class LocalContactsService extends LocalRouteDelayService {
  private static readonly CONTACTS_ROUTE = '/navigator/contacts';
  private readonly contactsRepository = inject(LocalContactsRepository);
  private readonly profileExperiencesRepository = inject(LocalProfileExperiencesRepository);
  private readonly usersRepository = inject(LocalUsersRepository);

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
    const user = this.usersRepository.queryUserById(normalizedUserId);
    return {
      user: user ? LocalUsersMapper.toDto(user) : null,
      experiences: LocalProfileExperiencesMapper.cloneEntries(
        this.profileExperiencesRepository.queryUserExperienceRecords(normalizedUserId)
      )
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
