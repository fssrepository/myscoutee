import { Injectable, inject } from '@angular/core';

import type { ProfileViewData } from '../../contracts/profile.interface';
import { LocalContactsService } from '../../local/source/services/contacts.service';
import { HttpContactsService } from '../../http/services/contacts.service';
import { BaseRouteModeService } from './base-route-mode.service';
import type * as ContactContracts from '../../contracts/contact.interface';

@Injectable({
  providedIn: 'root'
})
export class ContactsService extends BaseRouteModeService {
  private readonly localContactsService = inject(LocalContactsService);
  private readonly httpContactsService = inject(HttpContactsService);

  private get contactsService(): LocalContactsService | HttpContactsService {
    return this.resolveRouteService(
      '/navigator/contacts',
      this.localContactsService,
      this.httpContactsService
    );
  }

  loadContacts(userId: string): Promise<ContactContracts.StoredContact[]> {
    return this.contactsService.loadContacts(userId);
  }

  loadContactProfile(userId: string): Promise<ProfileViewData> {
    return this.contactsService.loadContactProfile(userId);
  }

  saveContacts(
    userId: string,
    contacts: readonly ContactContracts.StoredContact[]
  ): Promise<ContactContracts.StoredContact[]> {
    return this.contactsService.saveContacts(userId, contacts);
  }

  deleteContact(userId: string, contactId: string): Promise<ContactContracts.StoredContact[]> {
    return this.contactsService.deleteContact(userId, contactId);
  }
}
