import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ContactsService } from '../../../core/base/services/contacts.service';
import type { ContactChatAccess, ContactChatAccessAction, ContactChatAccessSnapshot, StoredContact } from '../../../core/contracts/contact.interface';
import { UserProfileStore } from './user-profile.store';
import { ActivityStore } from './activity.store';
import { ProfileStore } from './profile.store';

@Injectable({ providedIn: 'root' })
export class ContactChatAccessStore {
  private readonly service = inject(ContactsService);
  private readonly user = inject(UserProfileStore);
  private readonly activities = inject(ActivityStore);
  private readonly profile = inject(ProfileStore);
  private readonly recordsRef = signal<ContactChatAccess[]>([]);
  readonly records = this.recordsRef.asReadonly();
  readonly contacts = signal<StoredContact[] | null>(null);
  readonly contactCount = computed(() => this.activities.getUserCounterOverride(this.user.activeUserId(), 'contacts')
    ?? this.user.activeUserProfile()?.activities.contacts ?? 0);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly requestsOnly = signal(false);
  readonly pendingCount = computed(() => this.activities.getUserCounterOverride(this.user.activeUserId(), 'contactRequestsPending')
    ?? this.user.activeUserProfile()?.activities.contactRequestsPending ?? 0);
  private actor = '';
  private generation = 0;
  private refreshKey = '';
  private loading: Promise<void> | null = null;

  constructor() {
    effect(() => {
      const actor = this.user.activeUserId();
      const open = this.profile.contactsPopupOpen();
      const counters = this.activities.getUserCounterOverrides(actor);
      const notifications = counters.notifications ?? this.user.activeUserProfile()?.activities.notifications ?? 0;
      const key = `${actor}:${open}:${this.pendingCount()}:${this.contactCount()}:${notifications}`;
      untracked(() => {
        this.ensureActor(actor);
        if (key === this.refreshKey) return;
        this.refreshKey = key;
        if (open && actor && !this.busy()) void this.load().catch(() => {
          if (actor === this.user.activeUserId()) this.error.set(true);
        });
      });
    });
  }

  load(): Promise<void> {
    this.ensureActor(this.user.activeUserId());
    if (this.loading) return this.loading;
    const actor = this.user.activeUserId(), generation = ++this.generation;
    this.error.set(false);
    const request = this.service.loadChatAccess().then(snapshot => {
      if (actor === this.user.activeUserId() && generation === this.generation) this.apply(snapshot, actor);
    }).finally(() => { if (this.loading === request) this.loading = null; });
    this.loading = request;
    return request;
  }

  async change(contact: ContactChatAccess | undefined, peerId: string, action: ContactChatAccessAction): Promise<void> {
    this.ensureActor(this.user.activeUserId());
    if (this.busy()) return;
    const actor = this.user.activeUserId(), generation = ++this.generation;
    this.busy.set(true); this.error.set(false);
    try {
      const snapshot = await this.service.changeChatAccess(peerId, action, contact?.version);
      if (actor === this.user.activeUserId() && generation === this.generation) this.apply(snapshot, actor);
    } finally { if (actor === this.user.activeUserId() && generation === this.generation) this.busy.set(false); }
  }

  private ensureActor(actor: string): void {
    if (actor === this.actor) return;
    this.actor = actor;
    this.generation++;
    this.recordsRef.set([]);
    this.contacts.set(null);
    this.loading = null;
    this.busy.set(false);
    this.error.set(false);
  }

  replaceContacts(contacts: StoredContact[]): void {
    const actor = this.user.activeUserId();
    this.ensureActor(actor);
    // A read started before this saved edit cannot restore the older contact list.
    if (!this.busy()) this.generation++;
    this.loading = null;
    const notifications = this.activities.getUserCounterOverride(actor, 'notifications')
      ?? this.user.activeUserProfile()?.activities.notifications ?? 0;
    this.refreshKey = `${actor}:${this.profile.contactsPopupOpen()}:${this.pendingCount()}:${contacts.length}:${notifications}`;
    this.contacts.set(contacts);
    this.activities.setUserCounterOverride(actor, 'contacts', contacts.length);
  }

  private apply(snapshot: ContactChatAccessSnapshot, actor: string): void {
    this.recordsRef.set(snapshot.records);
    this.contacts.set(snapshot.contacts);
    this.activities.setUserCounterOverride(actor, 'contacts', snapshot.contacts.length);
    const notifications = this.activities.getUserCounterOverride(actor, 'notifications')
      ?? this.user.activeUserProfile()?.activities.notifications ?? 0;
    this.refreshKey = `${actor}:${this.profile.contactsPopupOpen()}:${snapshot.pendingCount}:${snapshot.contacts.length}:${notifications}`;
    this.activities.setUserCounterOverride(actor, 'contactRequestsPending', snapshot.pendingCount);
  }
}
