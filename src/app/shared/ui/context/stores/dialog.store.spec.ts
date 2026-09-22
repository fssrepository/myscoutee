import { describe, expect, it, vi } from 'vitest';

import { DialogStore } from './dialog.store';

describe('DialogStore optional confirmation message', () => {
  it('bounds the draft and passes it only on confirmation', async () => {
    const onConfirm = vi.fn(); const store = new DialogStore();
    store.open({ title: 'Reject', input: { label: 'Message', maxLength: 5 }, onConfirm });
    store.updateInput('abcdef'); expect(store.dialog()?.input?.value).toBe('abcde'); expect(onConfirm).not.toHaveBeenCalled();
    await store.confirm(); expect(onConfirm).toHaveBeenCalledWith('abcde'); expect(store.dialog()).toBeNull();
  });
  it('cancellation does not deliver a message', () => {
    const onConfirm = vi.fn(); const store = new DialogStore();
    store.open({ title: 'Block', input: { label: 'Message', maxLength: 100 }, onConfirm });
    store.updateInput('Draft'); store.cancel(); expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('DialogStore actionless notices', () => {
  it('opens without confirmation actions and closes through the normal dismiss path', () => {
    const onCancel = vi.fn();
    const store = new DialogStore();

    store.openNotice('event.members.invite.capacity.full.message', {
      title: 'event.members.invite.capacity.full.title',
      onCancel
    });

    expect(store.dialog()).toMatchObject({
      title: 'event.members.invite.capacity.full.title',
      message: 'event.members.invite.capacity.full.message',
      showActions: false,
      showClose: true,
      allowBackdropClose: true,
      allowEscapeClose: true
    });

    store.cancel();

    expect(store.dialog()).toBeNull();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
