import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { ProfileViewData } from '../../base/interfaces/profile.interface';
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

  async loadContacts(userId: string): Promise<AppTypes.StoredContact[]> {
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    return this.contactsRepository.queryContactsByUser(userId);
  }

  async loadContactProfile(userId: string): Promise<ProfileViewData> {
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return this.emptyProfileViewData();
    }
    const user = this.usersRepository.queryUserById(normalizedUserId);
    return {
      user: user ? this.clone(user) : null,
      experiences: this.profileExperiencesRepository.queryUserExperiences(normalizedUserId)
    };
  }

  async saveContacts(
    userId: string,
    contacts: readonly AppTypes.StoredContact[]
  ): Promise<AppTypes.StoredContact[]> {
    const savedContacts = this.contactsRepository.replaceContactsForUser(userId, contacts);
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    return savedContacts;
  }

  async deleteContact(userId: string, contactId: string): Promise<AppTypes.StoredContact[]> {
    const savedContacts = this.contactsRepository.deleteContact(userId, contactId);
    await this.waitForRouteDelay(LocalContactsService.CONTACTS_ROUTE);
    return savedContacts;
  }

  private emptyProfileViewData(): ProfileViewData {
    return {
      user: null,
      experiences: []
    };
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
