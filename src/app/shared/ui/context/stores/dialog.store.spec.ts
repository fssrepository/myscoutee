import { describe, expect, it, vi } from 'vitest';

import { DialogStore } from './dialog.store';

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
