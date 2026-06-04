import type { UserDto } from '../interfaces/user.interface';

export type NavigatorContactMethodType =
  | 'phone'
  | 'sms'
  | 'whatsapp'
  | 'email'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'linkedin'
  | 'website';

export interface NavigatorContactMethodOption {
  value: NavigatorContactMethodType;
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

export interface NavigatorContactMethodDraft {
  id: string;
  type: NavigatorContactMethodType;
  value: string;
}

export interface NavigatorStoredContact {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  createdAtIso: string;
  updatedAtIso: string;
  methods: NavigatorContactMethodDraft[];
}

export interface NavigatorContactMethodItem extends NavigatorContactMethodDraft {
  label: string;
  icon: string;
  displayValue: string;
  menuLabel: string;
  href: string;
  openBehavior: 'same-tab' | 'new-tab';
}

export interface NavigatorContactListItem {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  groupLabel: string;
  methodCount: number;
  methodCountLabel: string;
  methods: NavigatorContactMethodItem[];
  updatedAtIso: string;
  searchText: string;
}

export interface NavigatorContactFormValue {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  methods: NavigatorContactMethodDraft[];
}

export interface NavigatorContactListFilters {
  search?: string;
  refreshToken?: number;
}
