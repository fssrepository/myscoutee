import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { ProfileViewData } from '../interfaces/profile.interface';
import { LocalContactsService } from '../../local/services/contacts.service';
import { HttpContactsService } from '../../http/services/contacts.service';
import { BaseRouteModeService } from './base-route-mode.service';

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

  loadContacts(userId: string): Promise<AppTypes.StoredContact[]> {
    return this.contactsService.loadContacts(userId);
  }

  loadContactProfile(userId: string): Promise<ProfileViewData> {
    return this.contactsService.loadContactProfile(userId);
  }

  saveContacts(
    userId: string,
    contacts: readonly AppTypes.StoredContact[]
  ): Promise<AppTypes.StoredContact[]> {
    return this.contactsService.saveContacts(userId, contacts);
  }

  deleteContact(userId: string, contactId: string): Promise<AppTypes.StoredContact[]> {
    return this.contactsService.deleteContact(userId, contactId);
  }
}
