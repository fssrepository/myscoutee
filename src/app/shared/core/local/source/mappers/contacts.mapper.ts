import type {
  ContactMethodDraft,
  ContactMethodType,
  StoredContact
} from '../../../contracts/contact.interface';

export class LocalContactsMapper {
  static toStoredContact(value: Partial<StoredContact> | null | undefined): StoredContact | null {
    if (!value) {
      return null;
    }
    const id = `${value.id ?? ''}`.trim();
    const userId = `${value.userId ?? ''}`.trim();
    if (!id && !userId) {
      return null;
    }
    return {
      id: id || userId,
      userId,
      name: `${value.name ?? ''}`.trim() || 'Contact',
      initials: `${value.initials ?? ''}`.trim(),
      gender: value.gender === 'woman' ? 'woman' : 'man',
      city: `${value.city ?? ''}`.trim(),
      avatarUrl: `${value.avatarUrl ?? ''}`.trim(),
      headline: `${value.headline ?? ''}`.trim(),
      createdAtIso: `${value.createdAtIso ?? ''}`.trim(),
      updatedAtIso: `${value.updatedAtIso ?? ''}`.trim(),
      methods: (value.methods ?? [])
        .map(method => this.toMethodDraft(method))
        .filter((method): method is ContactMethodDraft => Boolean(method))
    };
  }

  static toStoredContacts(values: readonly Partial<StoredContact>[]): StoredContact[] {
    return values
      .map(value => this.toStoredContact(value))
      .filter((contact): contact is StoredContact => Boolean(contact));
  }

  static cloneContacts(contacts: readonly StoredContact[]): StoredContact[] {
    return contacts.map(contact => ({
      ...contact,
      methods: contact.methods.map(method => ({ ...method }))
    }));
  }

  private static toMethodDraft(
    value: Partial<ContactMethodDraft> | null | undefined
  ): ContactMethodDraft | null {
    if (!value) {
      return null;
    }
    const type = `${value.type ?? ''}`.trim() as ContactMethodType;
    const methodType: ContactMethodType = [
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
