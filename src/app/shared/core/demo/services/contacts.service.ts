import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { ProfileViewData } from '../../base/interfaces/profile.interface';
import type { UserDto } from '../../base/interfaces/user.interface';
import { DemoContactsRepository } from '../repositories/contacts.repository';
import { DemoProfileExperiencesRepository } from '../repositories/profile-experiences.repository';
import { DemoUsersRepository } from '../repositories/users.repository';
import { DemoRouteDelayService } from './demo-route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class DemoContactsService extends DemoRouteDelayService {
  private static readonly CONTACTS_ROUTE = '/navigator/contacts';
  private readonly contactsRepository = inject(DemoContactsRepository);
  private readonly profileExperiencesRepository = inject(DemoProfileExperiencesRepository);
  private readonly usersRepository = inject(DemoUsersRepository);

  async loadContacts(userId: string): Promise<AppTypes.StoredContact[]> {
    await this.waitForRouteDelay(DemoContactsService.CONTACTS_ROUTE);
    return this.contactsRepository.queryContactsByUser(userId);
  }

  async loadContactProfile(userId: string): Promise<ProfileViewData> {
    await this.waitForRouteDelay(DemoContactsService.CONTACTS_ROUTE);
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
    await this.waitForRouteDelay(DemoContactsService.CONTACTS_ROUTE);
    return savedContacts;
  }

  async deleteContact(userId: string, contactId: string): Promise<AppTypes.StoredContact[]> {
    const savedContacts = this.contactsRepository.deleteContact(userId, contactId);
    await this.waitForRouteDelay(DemoContactsService.CONTACTS_ROUTE);
    return savedContacts;
  }

  seedDefaultContacts(users: readonly UserDto[]): boolean {
    return this.contactsRepository.seedDefaultContacts(users);
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
