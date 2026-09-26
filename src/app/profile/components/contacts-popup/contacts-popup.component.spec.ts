import { signal } from '@angular/core';
import { ContactsPopupComponent } from './contacts-popup.component';

describe('Contacts permission buckets', () => {
  function popup() {
    const component = Object.create(ContactsPopupComponent.prototype);
    Object.assign(component, {
      activeUserId: () => 'recipient', searchText: () => '', openingContactChat: () => false,
      chatAccess: { requestsOnly: signal(true), busy: () => false, change: vi.fn().mockResolvedValue(undefined) },
      dialogStore: { open: vi.fn(), openNotice: vi.fn() }, closeActionMenu: vi.fn(),
      contactsSmartList: { itemsSnapshot: () => [], replaceVisibleItems: vi.fn(), reload: vi.fn() },
      hasInitialLoadCompleted: () => true, profileStore: { closeContactsPopup: vi.fn() },
      compareContacts: (a: {id: string}, b: {id: string}) => a.id.localeCompare(b.id)
    });
    return component;
  }
  const row = (id: string, requestedBy: string, status = 'pending', saved = false) => ({
    id, userId: id, name: id, methods: [], searchText: id, saved,
    chatAccess: { requestedBy, status, requestedAtIso: `2026-09-26T${id === 'new' ? '12' : '10'}:00:00Z`, version: 0 }
  });
  it('shows incoming pending requests newest first and moves approved entries without reloading', () => {
    const component = popup();
    let rows = [row('old', 'sender'), row('new', 'sender'), row('outgoing', 'recipient', 'pending', true)];
    component.contactListItems = () => rows;
    expect(component.filteredContacts().map((r: {id: string}) => r.id)).toEqual(['new', 'old']);
    rows = [rows[0], row('new', 'sender', 'approved', true), rows[2]];
    component.reconcileContactRows();
    expect(component.contactsSmartList.replaceVisibleItems.mock.calls[0][0].map((r: {id: string}) => r.id)).toEqual(['old']);
    component.selectBucket({ id: 'contacts' });
    expect(component.filteredContacts().map((r: {id: string}) => r.id)).toEqual(['new', 'outgoing']);
    expect(component.contactsSmartList.reload).not.toHaveBeenCalled();
  });
  it('uses confirmation without closing contacts and writes only on confirm', async () => {
    const component = popup();
    const contact = row('new', 'sender');
    component.confirmChatAccess(contact, 'approve');
    expect(component.chatAccess.change).not.toHaveBeenCalled();
    expect(component.profileStore.closeContactsPopup).not.toHaveBeenCalled();
    const dialog = component.dialogStore.open.mock.calls[0][0];
    expect(dialog.cancelLabel).toBe('Cancel');
    await dialog.onConfirm();
    expect(component.chatAccess.change).toHaveBeenCalledWith(contact.chatAccess, 'new', 'approve');
  });
  it('does not resend outgoing pending requests and colours chat by state', async () => {
    const component = popup();
    await component.openContactChat(row('outgoing', 'recipient'));
    expect(component.dialogStore.openNotice).toHaveBeenCalled();
    expect(component.chatAccess.change).not.toHaveBeenCalled();
    expect(component.chatPalette(row('new', 'sender'))).toBe('orange');
    expect(component.chatPalette(row('new', 'sender', 'approved'))).toBe('green');
    expect(component.chatPalette(row('new', 'sender', 'rejected'))).toBe('red');
  });
  it('keeps rejection separate from cancel and hides delete for unsaved requests', () => {
    const component = popup();
    const actions = component.contactActionMenuItems(row('new', 'sender')).map((item: {context?: {action: string}}) => item.context?.action);
    expect(actions).toContain('approve'); expect(actions).toContain('reject'); expect(actions).not.toContain('delete');
  });
});
