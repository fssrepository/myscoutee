import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ContactChatAccessStore } from './contact-chat-access.store';
import { ContactsService } from '../../../core/base/services/contacts.service';
import { UserProfileStore } from './user-profile.store';
import { ActivityStore } from './activity.store';
import { ProfileStore } from './profile.store';
import type { ContactChatAccessSnapshot } from '../../../core/contracts/contact.interface';

describe('Contact chat live store', () => {
  const actor = signal('recipient');
  const open = signal(false);
  const counters = signal<Record<string, number>>({ contacts: 14, contactRequestsPending: 2 });
  const service = { loadChatAccess: vi.fn(), changeChatAccess: vi.fn() };
  let store: ContactChatAccessStore;
  beforeEach(() => {
    actor.set('recipient'); open.set(false); counters.set({ contacts: 14, contactRequestsPending: 2 });
    service.loadChatAccess.mockReset(); service.changeChatAccess.mockReset();
    TestBed.configureTestingModule({ providers: [
      { provide: ContactsService, useValue: service },
      { provide: UserProfileStore, useValue: { activeUserId: actor, activeUserProfile: () => ({ activities: {} }) } },
      { provide: ProfileStore, useValue: { contactsPopupOpen: open } },
      { provide: ActivityStore, useValue: { getUserCounterOverrides: () => counters(),
        getUserCounterOverride: (_actor: string, key: string) => counters()[key],
        setUserCounterOverride: (_actor: string, key: string, value: number) => counters.update(c => ({ ...c, [key]: value })) } }
    ] });
    store = TestBed.inject(ContactChatAccessStore);
    TestBed.tick();
  });
  afterEach(() => TestBed.resetTestingModule());
  it('shows the canonical pending count, independent of saved contacts or loaded request rows', () => {
    expect(store.pendingCount()).toBe(2);
    expect(store.contactCount()).toBe(14);
    expect(store.records()).toEqual([]);
  });
  it('applies a confirmed mutation immediately without another load', async () => {
    service.changeChatAccess.mockResolvedValue({ records: [], pendingCount: 1, contacts: [] });
    await store.change(undefined, 'peer', 'approve');
    TestBed.tick();
    expect(store.pendingCount()).toBe(1);
    expect(service.loadChatAccess).not.toHaveBeenCalled();
  });
  it('retains state on error and permits retry', async () => {
    service.changeChatAccess.mockRejectedValueOnce(new Error('unavailable'));
    await expect(store.change(undefined, 'peer', 'request')).rejects.toThrow('unavailable');
    expect(store.pendingCount()).toBe(2);
    expect(store.busy()).toBe(false);
    service.changeChatAccess.mockResolvedValue({ records: [], pendingCount: 2, contacts: [] });
    await store.change(undefined, 'peer', 'request');
    expect(service.changeChatAccess).toHaveBeenCalledTimes(2);
  });
  it('does not restore contacts from a read that predates a saved edit', async () => {
    let complete!: (snapshot: ContactChatAccessSnapshot) => void;
    service.loadChatAccess.mockReturnValue(new Promise(resolve => complete = resolve));
    const loading = store.load();
    store.replaceContacts([]);
    complete({ records: [], pendingCount: 99, contacts: [] });
    await loading;
    expect(store.pendingCount()).toBe(2);
    expect(store.contactCount()).toBe(0);
    expect(service.loadChatAccess).toHaveBeenCalledTimes(1);
  });
  it('ignores a response from a previous account', async () => {
    let complete!: (snapshot: ContactChatAccessSnapshot) => void;
    service.loadChatAccess.mockReturnValue(new Promise(resolve => complete = resolve));
    const loading = store.load();
    actor.set('other'); TestBed.tick();
    complete({ records: [], pendingCount: 99, contacts: [] });
    await loading;
    expect(store.pendingCount()).toBe(2);
    expect(store.contacts()).toBeNull();
  });
  it('refreshes open request rows on a counter signal, without polling by itself', async () => {
    service.loadChatAccess.mockResolvedValue({ records: [], pendingCount: 3, contacts: [] });
    open.set(true); counters.update(value => ({ ...value, contactRequestsPending: 3 }));
    TestBed.tick();
    await store.load();
    TestBed.tick();
    expect(service.loadChatAccess).toHaveBeenCalledTimes(1);
    expect(store.pendingCount()).toBe(3);
  });
});
