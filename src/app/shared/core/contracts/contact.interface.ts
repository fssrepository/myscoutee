import type * as UserContracts from './user.interface';

export type ContactMethodType =
  | 'phone'
  | 'sms'
  | 'whatsapp'
  | 'email'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'linkedin'
  | 'website';

export interface ContactMethodOption {
  value: ContactMethodType;
  label: string;
  icon: string;
  placeholder: string;
  helpText: string;
  inputType: 'text' | 'tel' | 'email' | 'url';
  inputMode: 'text' | 'tel' | 'email' | 'url';
  autocomplete: string;
  actionLabel: string;
  openBehavior: 'same-tab' | 'new-tab';
}

export interface ContactMethodDraft {
  id: string;
  type: ContactMethodType;
  value: string;
}

export interface StoredContact {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserContracts.UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  createdAtIso: string;
  updatedAtIso: string;
  methods: ContactMethodDraft[];
}

export interface ContactMethodItem extends ContactMethodDraft {
  label: string;
  icon: string;
  displayValue: string;
  menuLabel: string;
  href: string;
  openBehavior: 'same-tab' | 'new-tab';
}

export interface ContactListItem {
  chatAccess?: ContactChatAccess;
  saved?: boolean;
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserContracts.UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  groupLabel: string;
  methodCount: number;
  methodCountLabel: string;
  methods: ContactMethodItem[];
  updatedAtIso: string;
  searchText: string;
}

export interface ContactFormValue {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserContracts.UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  methods: ContactMethodDraft[];
}

export interface ContactListFilters {
  requestsOnly?: boolean;
  search?: string;
  refreshToken?: number;
}

export type ContactChatAccessStatus = 'pending' | 'approved' | 'rejected';
export type ContactChatAccessAction = 'request' | 'approve' | 'reject';
export interface ContactChatAccess {
  id: string;
  requestedBy: string;
  status: ContactChatAccessStatus;
  requestedAtIso: string;
  decidedAtIso: string | null;
  version: number;
  contact: StoredContact;
}

export interface ContactChatAccessSnapshot {
  records: ContactChatAccess[];
  pendingCount: number;
  contacts: StoredContact[];
}
