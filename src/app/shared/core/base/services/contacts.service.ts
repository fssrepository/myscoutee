import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import type { ProfileViewData } from '../interfaces/profile.interface';
import { DemoContactsService } from '../../demo/services/contacts.service';
import { HttpContactsService } from '../../http/services/contacts.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class ContactsService extends BaseRouteModeService {
  private readonly demoContactsService = inject(DemoContactsService);
  private readonly httpContactsService = inject(HttpContactsService);

  private get contactsService(): DemoContactsService | HttpContactsService {
    return this.resolveRouteService(
      '/navigator/contacts',
      this.demoContactsService,
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
