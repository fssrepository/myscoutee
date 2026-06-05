import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { UserDto } from '../../base/interfaces/user.interface';
import { DemoContactsRepository } from '../repositories/contacts.repository';
import { DemoRouteDelayService } from './demo-route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class DemoContactsService extends DemoRouteDelayService {
  private static readonly CONTACTS_ROUTE = '/navigator/contacts';
  private readonly contactsRepository = inject(DemoContactsRepository);

  async loadContacts(userId: string): Promise<AppTypes.StoredContact[]> {
    await this.waitForRouteDelay(DemoContactsService.CONTACTS_ROUTE);
    return this.contactsRepository.queryContactsByUser(userId);
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
}
