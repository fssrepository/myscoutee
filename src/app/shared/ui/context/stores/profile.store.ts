import { Injectable, Type, computed, signal } from '@angular/core';

import type { ActivityMemberOwnerType } from '../../../core/common/constants';
import type { UserDto } from '../../../core/contracts/user.interface';

export type ProfileSettingsPopup = 'help' | 'feedback' | 'privacy' | 'terms' | 'report-user';

export interface ProfileReportUserContext {
  targetUserId: string;
  targetName: string;
  memberEntryId?: string | null;
  eventId: string;
  eventTitle?: string | null;
  eventStartAtIso?: string | null;
  eventTimeframe?: string | null;
  ownerType?: ActivityMemberOwnerType;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceText?: string | null;
  chatId?: string | null;
  messageId?: string | null;
  assetId?: string | null;
  assetType?: string | null;
}

export interface ProfileBindings {
  syncHydratedUser?(user: UserDto): void;
}

export interface ProfileViewRequest {
  userId: string;
  label?: string | null;
}

export interface ProfileViewTarget {
  userId: string;
  label: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileStore {
  private readonly bindingsRef = signal<ProfileBindings | null>(null);
  private readonly settingsPopupRef = signal<ProfileSettingsPopup | null>(null);
  private readonly reportUserContextRef = signal<ProfileReportUserContext | null>(null);
  private readonly deletedAccountReactivationPendingRef = signal(false);
  private readonly privacyConsentRequiredKeyRef = signal('');
  private readonly profileEditorOpenRef = signal(false);
  private readonly profileViewTargetRef = signal<ProfileViewTarget | null>(null);
  private readonly impressionsPopupOpenRef = signal(false);
  private readonly contactsPopupOpenRef = signal(false);
  private readonly impressionsPopupUserIdRef = signal('');
  private readonly impressionsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly profileEditorComponentRef = signal<Type<unknown> | null>(null);
  private readonly profileViewPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly contactsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly explanationPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly bindings = this.bindingsRef.asReadonly();
  readonly profileEditorOpen = this.profileEditorOpenRef.asReadonly();
  readonly profileViewTarget = this.profileViewTargetRef.asReadonly();
  readonly profileViewOpen = computed(() => this.profileViewTargetRef() !== null);
  readonly settingsPopup = this.settingsPopupRef.asReadonly();
  readonly privacyConsentRequired = computed(() => this.privacyConsentRequiredKeyRef().length > 0);
  readonly privacyConsentRequiredKey = this.privacyConsentRequiredKeyRef.asReadonly();
  readonly reportUserContext = this.reportUserContextRef.asReadonly();
  readonly deletedAccountReactivationPending = this.deletedAccountReactivationPendingRef.asReadonly();
  readonly impressionsPopupOpen = this.impressionsPopupOpenRef.asReadonly();
  readonly contactsPopupOpen = this.contactsPopupOpenRef.asReadonly();
  readonly impressionsPopupUserId = this.impressionsPopupUserIdRef.asReadonly();
  readonly impressionsPopupComponent = this.impressionsPopupComponentRef.asReadonly();
  readonly profileEditorComponent = this.profileEditorComponentRef.asReadonly();
  readonly profileViewPopupComponent = this.profileViewPopupComponentRef.asReadonly();
  readonly contactsPopupComponent = this.contactsPopupComponentRef.asReadonly();
  readonly explanationPopupComponent = this.explanationPopupComponentRef.asReadonly();

  registerBindings(bindings: ProfileBindings): void {
    this.bindingsRef.set(bindings);
  }

  clearBindings(bindings?: ProfileBindings): void {
    if (bindings && this.bindingsRef() !== bindings) {
      return;
    }
    this.bindingsRef.set(null);
    this.closeSettingsPopup({ force: true });
    this.closeImpressionsPopup();
    this.closeContactsPopup();
    this.closeProfileEditor();
    this.closeProfileView();
  }

  openProfileEditor(): void {
    this.profileEditorOpenRef.set(true);
  }

  closeProfileEditor(): void {
    this.profileEditorOpenRef.set(false);
  }

  openProfileView(request: ProfileViewRequest): void {
    const userId = `${request?.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    const targetLabel = `${request.label ?? ''}`.trim() || null;
    const currentTarget = this.profileViewTargetRef();
    if (currentTarget?.userId === userId && currentTarget.label === targetLabel) {
      return;
    }
    this.profileViewTargetRef.set({
      userId,
      label: targetLabel
    });
  }

  closeProfileView(): void {
    this.profileViewTargetRef.set(null);
  }

  openSettingsPopup(popup: ProfileSettingsPopup): void {
    if (popup !== 'report-user') {
      this.reportUserContextRef.set(null);
    }
    this.settingsPopupRef.set(popup);
  }

  closeSettingsPopup(options: { force?: boolean; keepPrivacyOpen?: boolean } = {}): void {
    if (options.force !== true && options.keepPrivacyOpen === true && this.settingsPopupRef() === 'privacy') {
      return;
    }
    if (this.settingsPopupRef() === 'report-user') {
      this.reportUserContextRef.set(null);
    }
    this.settingsPopupRef.set(null);
  }

  setPrivacyConsentRequiredKey(key: string): void {
    this.privacyConsentRequiredKeyRef.set(key.trim());
  }

  clearPrivacyConsentRequirement(): void {
    this.privacyConsentRequiredKeyRef.set('');
  }

  setDeletedAccountReactivationPending(pending: boolean): void {
    this.deletedAccountReactivationPendingRef.set(pending);
  }

  openReportUserPopup(context: ProfileReportUserContext): void {
    const targetUserId = `${context.targetUserId ?? ''}`.trim();
    const eventId = `${context.eventId ?? ''}`.trim();
    const targetName = `${context.targetName ?? ''}`.trim();
    if (!targetUserId || !eventId || !targetName) {
      return;
    }
    this.reportUserContextRef.set({
      targetUserId,
      targetName,
      memberEntryId: `${context.memberEntryId ?? ''}`.trim() || null,
      eventId,
      eventTitle: `${context.eventTitle ?? ''}`.trim() || null,
      eventStartAtIso: `${context.eventStartAtIso ?? ''}`.trim() || null,
      eventTimeframe: `${context.eventTimeframe ?? ''}`.trim() || null,
      ownerType: context.ownerType,
      sourceType: `${context.sourceType ?? ''}`.trim() || null,
      sourceId: `${context.sourceId ?? ''}`.trim() || null,
      sourceText: `${context.sourceText ?? ''}`.trim() || null,
      chatId: `${context.chatId ?? ''}`.trim() || null,
      messageId: `${context.messageId ?? ''}`.trim() || null,
      assetId: `${context.assetId ?? ''}`.trim() || null,
      assetType: `${context.assetType ?? ''}`.trim() || null
    });
    this.settingsPopupRef.set('report-user');
  }

  openImpressionsPopup(userId: string): void {
    this.impressionsPopupUserIdRef.set(userId.trim());
    this.impressionsPopupOpenRef.set(true);
  }

  closeImpressionsPopup(): void {
    this.impressionsPopupOpenRef.set(false);
    this.impressionsPopupUserIdRef.set('');
  }

  openContactsPopup(): void {
    this.contactsPopupOpenRef.set(true);
  }

  closeContactsPopup(): void {
    this.contactsPopupOpenRef.set(false);
  }

  async ensureImpressionsPopupLoaded(): Promise<void> {
    if (this.impressionsPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../profile/components/impressions-popup/impressions-popup.component');
    this.impressionsPopupComponentRef.set(module.ProfileImpressionsPopupComponent);
  }

  async ensureProfileEditorLoaded(): Promise<void> {
    if (this.profileEditorComponentRef()) {
      return;
    }
    const module = await import('../../../../profile/components/profile-editor/profile-editor.component');
    this.profileEditorComponentRef.set(module.ProfileEditorComponent);
  }

  async ensureProfileViewPopupLoaded(): Promise<void> {
    if (this.profileViewPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../profile/components/profile-view-popup/profile-view-popup.component');
    this.profileViewPopupComponentRef.set(module.ProfileViewPopupComponent);
  }

  async ensureContactsPopupLoaded(): Promise<void> {
    if (this.contactsPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../profile/components/contacts-popup/contacts-popup.component');
    this.contactsPopupComponentRef.set(module.ContactsPopupComponent);
  }

  async ensureExplanationPopupLoaded(): Promise<void> {
    if (this.explanationPopupComponentRef()) {
      return;
    }
    const module = await import('../../components/explanation-popup/explanation-popup.component');
    this.explanationPopupComponentRef.set(module.ExplanationPopupComponent);
  }
}
