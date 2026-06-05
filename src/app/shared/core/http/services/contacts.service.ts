import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';

interface ContactsSaveRequest {
  userId: string;
  contacts: AppTypes.StoredContact[];
}

@Injectable({
  providedIn: 'root'
})
export class HttpContactsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadContacts(userId: string): Promise<AppTypes.StoredContact[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const response = await this.http
      .get<Array<Partial<AppTypes.StoredContact>> | null>(`${this.apiBaseUrl}/navigator/contacts`, {
        params: new HttpParams().set('userId', normalizedUserId)
      })
      .toPromise();
    return this.normalizeContacts(response);
  }

  async saveContacts(
    userId: string,
    contacts: readonly AppTypes.StoredContact[]
  ): Promise<AppTypes.StoredContact[]> {
    const request: ContactsSaveRequest = {
      userId: userId.trim(),
      contacts: this.cloneContacts(contacts)
    };
    const response = await this.http
      .put<Array<Partial<AppTypes.StoredContact>> | null>(`${this.apiBaseUrl}/navigator/contacts`, request)
      .toPromise();
    return this.normalizeContacts(response);
  }

  async deleteContact(userId: string, contactId: string): Promise<AppTypes.StoredContact[]> {
    const response = await this.http
      .request<Array<Partial<AppTypes.StoredContact>> | null>(
        'delete',
        `${this.apiBaseUrl}/navigator/contacts/${encodeURIComponent(contactId.trim())}`,
        { body: { userId: userId.trim() } }
      )
      .toPromise();
    return this.normalizeContacts(response);
  }

  private normalizeContacts(value: Array<Partial<AppTypes.StoredContact>> | null | undefined): AppTypes.StoredContact[] {
    return (Array.isArray(value) ? value : [])
      .map(contact => this.normalizeContact(contact))
      .filter((contact): contact is AppTypes.StoredContact => Boolean(contact));
  }

  private normalizeContact(value: Partial<AppTypes.StoredContact> | null | undefined): AppTypes.StoredContact | null {
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
        .map(method => this.normalizeMethod(method))
        .filter((method): method is AppTypes.ContactMethodDraft => Boolean(method))
    };
  }

  private normalizeMethod(
    value: Partial<AppTypes.ContactMethodDraft> | null | undefined
  ): AppTypes.ContactMethodDraft | null {
    if (!value) {
      return null;
    }
    const type = `${value.type ?? ''}`.trim() as AppTypes.ContactMethodType;
    const methodType: AppTypes.ContactMethodType = [
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

  private cloneContacts(contacts: readonly AppTypes.StoredContact[]): AppTypes.StoredContact[] {
    return contacts.map(contact => ({
      ...contact,
      methods: contact.methods.map(method => ({ ...method }))
    }));
  }
}
