import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import type { ProfileViewData } from '../../contracts/profile.interface';
import type { UserDto } from '../../contracts/user.interface';
import type * as ContactContracts from '../../contracts/contact.interface';
import type * as ProfileContracts from '../../contracts/profile.interface';

interface ContactsSaveRequest {
  userId: string;
  contacts: ContactContracts.StoredContact[];
}

@Injectable({
  providedIn: 'root'
})
export class HttpContactsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadContacts(userId: string): Promise<ContactContracts.StoredContact[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const response = await this.http
      .get<Array<Partial<ContactContracts.StoredContact>> | null>(`${this.apiBaseUrl}/navigator/contacts`, {
        params: new HttpParams().set('userId', normalizedUserId)
      })
      .toPromise();
    return this.normalizeContacts(response);
  }

  async loadContactProfile(userId: string): Promise<ProfileViewData> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return this.emptyProfileViewData();
    }
    const response = await this.http
      .get<Partial<ProfileViewData> | null>(
        `${this.apiBaseUrl}/navigator/contacts/${encodeURIComponent(normalizedUserId)}/profile`
      )
      .toPromise();
    return this.normalizeProfileView(response);
  }

  async saveContacts(
    userId: string,
    contacts: readonly ContactContracts.StoredContact[]
  ): Promise<ContactContracts.StoredContact[]> {
    const request: ContactsSaveRequest = {
      userId: userId.trim(),
      contacts: this.cloneContacts(contacts)
    };
    const response = await this.http
      .put<Array<Partial<ContactContracts.StoredContact>> | null>(`${this.apiBaseUrl}/navigator/contacts`, request)
      .toPromise();
    return this.normalizeContacts(response);
  }

  async deleteContact(userId: string, contactId: string): Promise<ContactContracts.StoredContact[]> {
    const response = await this.http
      .request<Array<Partial<ContactContracts.StoredContact>> | null>(
        'delete',
        `${this.apiBaseUrl}/navigator/contacts/${encodeURIComponent(contactId.trim())}`,
        { body: { userId: userId.trim() } }
      )
      .toPromise();
    return this.normalizeContacts(response);
  }

  private normalizeContacts(value: Array<Partial<ContactContracts.StoredContact>> | null | undefined): ContactContracts.StoredContact[] {
    return (Array.isArray(value) ? value : [])
      .map(contact => this.normalizeContact(contact))
      .filter((contact): contact is ContactContracts.StoredContact => Boolean(contact));
  }

  private normalizeContact(value: Partial<ContactContracts.StoredContact> | null | undefined): ContactContracts.StoredContact | null {
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
        .filter((method): method is ContactContracts.ContactMethodDraft => Boolean(method))
    };
  }

  private normalizeMethod(
    value: Partial<ContactContracts.ContactMethodDraft> | null | undefined
  ): ContactContracts.ContactMethodDraft | null {
    if (!value) {
      return null;
    }
    const type = `${value.type ?? ''}`.trim() as ContactContracts.ContactMethodType;
    const methodType: ContactContracts.ContactMethodType = [
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

  private cloneContacts(contacts: readonly ContactContracts.StoredContact[]): ContactContracts.StoredContact[] {
    return contacts.map(contact => ({
      ...contact,
      methods: contact.methods.map(method => ({ ...method }))
    }));
  }

  private normalizeProfileView(value: Partial<ProfileViewData> | null | undefined): ProfileViewData {
    return {
      user: value?.user ? this.cloneUser(value.user) : null,
      experiences: this.normalizeExperienceEntries(value?.experiences)
    };
  }

  private emptyProfileViewData(): ProfileViewData {
    return {
      user: null,
      experiences: []
    };
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      profileDetails: (user.profileDetails ?? []).map(group => ({
        title: `${group.title ?? ''}`,
        rows: (group.rows ?? []).map(row => ({
          labelKey: `${row.labelKey ?? ''}`,
          value: `${row.value ?? ''}`,
          privacy: row.privacy,
          options: [...(row.options ?? [])]
        }))
      })),
      activities: {
        ...user.activities,
        event: user.activities?.event ? { ...user.activities.event } : undefined,
        asset: user.activities?.asset ? { ...user.activities.asset } : undefined,
        eventFeedback: user.activities?.eventFeedback ? { ...user.activities.eventFeedback } : undefined
      }
    };
  }

  private normalizeExperienceEntries(entries: readonly Partial<ProfileContracts.ExperienceEntry>[] | null | undefined): ProfileContracts.ExperienceEntry[] {
    return (Array.isArray(entries) ? entries : [])
      .map(entry => this.normalizeExperienceEntry(entry))
      .filter((entry): entry is ProfileContracts.ExperienceEntry => Boolean(entry));
  }

  private normalizeExperienceEntry(entry: Partial<ProfileContracts.ExperienceEntry> | null | undefined): ProfileContracts.ExperienceEntry | null {
    const id = `${entry?.id ?? ''}`.trim();
    if (!id) {
      return null;
    }
    const type = entry?.type === 'School'
      || entry?.type === 'Online Session'
      || entry?.type === 'Additional Project'
      ? entry.type
      : 'Workspace';
    return {
      id,
      type,
      title: `${entry?.title ?? ''}`.trim(),
      org: `${entry?.org ?? ''}`.trim(),
      city: `${entry?.city ?? ''}`.trim(),
      dateFrom: `${entry?.dateFrom ?? ''}`.trim(),
      dateTo: `${entry?.dateTo ?? ''}`.trim() || 'Present',
      description: `${entry?.description ?? ''}`.trim()
    };
  }
}
