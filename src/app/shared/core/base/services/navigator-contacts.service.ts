import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { DemoNavigatorContactsService } from '../../demo/services/navigator-contacts.service';
import { HttpNavigatorContactsService } from '../../http/services/navigator-contacts.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class NavigatorContactsService extends BaseRouteModeService {
  private readonly demoNavigatorContactsService = inject(DemoNavigatorContactsService);
  private readonly httpNavigatorContactsService = inject(HttpNavigatorContactsService);

  private get contactsService(): DemoNavigatorContactsService | HttpNavigatorContactsService {
    return this.resolveRouteService(
      '/navigator/contacts',
      this.demoNavigatorContactsService,
      this.httpNavigatorContactsService
    );
  }

  loadContacts(userId: string): Promise<AppTypes.NavigatorStoredContact[]> {
    return this.contactsService.loadContacts(userId);
  }

  saveContacts(
    userId: string,
    contacts: readonly AppTypes.NavigatorStoredContact[]
  ): Promise<AppTypes.NavigatorStoredContact[]> {
    return this.contactsService.saveContacts(userId, contacts);
  }

  deleteContact(userId: string, contactId: string): Promise<AppTypes.NavigatorStoredContact[]> {
    return this.contactsService.deleteContact(userId, contactId);
  }
}
