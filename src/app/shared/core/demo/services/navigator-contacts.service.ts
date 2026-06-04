import { Injectable } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { navigatorContactsStorageKey } from '../../base/storage-scope';
import { DemoRouteDelayService } from './demo-route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class DemoNavigatorContactsService extends DemoRouteDelayService {
  private static readonly CONTACTS_ROUTE = '/navigator/contacts';

  async loadContacts(userId: string): Promise<AppTypes.NavigatorStoredContact[]> {
    await this.waitForRouteDelay(DemoNavigatorContactsService.CONTACTS_ROUTE);
    return this.readContacts(userId);
  }

  async saveContacts(
    userId: string,
    contacts: readonly AppTypes.NavigatorStoredContact[]
  ): Promise<AppTypes.NavigatorStoredContact[]> {
    const normalizedContacts = this.cloneContacts(contacts);
    this.writeContacts(userId, normalizedContacts);
    await this.waitForRouteDelay(DemoNavigatorContactsService.CONTACTS_ROUTE);
    return this.cloneContacts(normalizedContacts);
  }

  async deleteContact(userId: string, contactId: string): Promise<AppTypes.NavigatorStoredContact[]> {
    const normalizedContactId = contactId.trim();
    const nextContacts = this.readContacts(userId).filter(contact => contact.id !== normalizedContactId);
    this.writeContacts(userId, nextContacts);
    await this.waitForRouteDelay(DemoNavigatorContactsService.CONTACTS_ROUTE);
    return this.cloneContacts(nextContacts);
  }

  private readContacts(userId: string): AppTypes.NavigatorStoredContact[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || typeof window === 'undefined') {
      return [];
    }
    const rawValue = window.localStorage.getItem(navigatorContactsStorageKey(normalizedUserId));
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(contact => this.toStoredContact(contact))
      .filter((contact): contact is AppTypes.NavigatorStoredContact => Boolean(contact));
  }

  private writeContacts(userId: string, contacts: readonly AppTypes.NavigatorStoredContact[]): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      navigatorContactsStorageKey(normalizedUserId),
      JSON.stringify(this.cloneContacts(contacts))
    );
  }

  private cloneContacts(contacts: readonly AppTypes.NavigatorStoredContact[]): AppTypes.NavigatorStoredContact[] {
    return contacts.map(contact => ({
      ...contact,
      methods: contact.methods.map(method => ({ ...method }))
    }));
  }

  private toStoredContact(value: Partial<AppTypes.NavigatorStoredContact> | null | undefined): AppTypes.NavigatorStoredContact | null {
    if (!value) {
      return null;
    }
    const id = `${value.id ?? ''}`.trim();
    const userId = `${value.userId ?? ''}`.trim();
    if (!id && !userId) {
      return null;
    }
    const name = `${value.name ?? ''}`.trim() || 'Contact';
    return {
      id: id || userId,
      userId,
      name,
      initials: `${value.initials ?? ''}`.trim(),
      gender: value.gender === 'woman' ? 'woman' : 'man',
      city: `${value.city ?? ''}`.trim(),
      avatarUrl: `${value.avatarUrl ?? ''}`.trim(),
      headline: `${value.headline ?? ''}`.trim(),
      createdAtIso: `${value.createdAtIso ?? ''}`.trim(),
      updatedAtIso: `${value.updatedAtIso ?? ''}`.trim(),
      methods: (value.methods ?? [])
        .map(method => this.toMethodDraft(method))
        .filter((method): method is AppTypes.NavigatorContactMethodDraft => Boolean(method))
    };
  }

  private toMethodDraft(
    value: Partial<AppTypes.NavigatorContactMethodDraft> | null | undefined
  ): AppTypes.NavigatorContactMethodDraft | null {
    if (!value) {
      return null;
    }
    const type = `${value.type ?? ''}`.trim() as AppTypes.NavigatorContactMethodType;
    const methodType: AppTypes.NavigatorContactMethodType = [
      'phone',
      'sms',
      'whatsapp',
      'email',
      'facebook',
      'instagram',
      'telegram',
      'linkedin',
      'website'
    ].includes(type) ? type : 'phone';
    const methodValue = `${value.value ?? ''}`.trim();
    if (!methodValue) {
      return null;
    }
    return {
      id: `${value.id ?? ''}`.trim(),
      type: methodType,
      value: methodValue
    };
  }
}
