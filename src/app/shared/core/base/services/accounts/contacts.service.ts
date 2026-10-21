import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import type { ContactChatAccessAction, ContactChatAccessSnapshot } from '../../../contracts/accounts/contact.interface';
import { Injectable, inject } from '@angular/core';

import type { ProfileViewData } from '../../../contracts/accounts/profile.interface';

import { BaseRouteModeService } from '../platform/base-route-mode.service';
import type * as ContactContracts from '../../../contracts/accounts/contact.interface';

@Injectable({
  providedIn: 'root'
})
export class ContactsService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly localContactsService = this.transportAdapters.reference(LOCAL_ADAPTER.CONTACTS);
  private readonly httpContactsService = this.transportAdapters.reference(HTTP_ADAPTER.CONTACTS);

  private get contactsService(): AdapterInstance<typeof LOCAL_ADAPTER.CONTACTS> | AdapterInstance<typeof HTTP_ADAPTER.CONTACTS> {
    return this.resolveRouteService(
      '/navigator/contacts',
      this.localContactsService,
      this.httpContactsService
    );
  }

  loadChatAccess(): Promise<ContactChatAccessSnapshot> {
    return this.contactsService.loadChatAccess();
  }

  changeChatAccess(userId: string, action: ContactChatAccessAction, version?: number): Promise<ContactChatAccessSnapshot> {
    return this.contactsService.changeChatAccess(userId, action, version);
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
