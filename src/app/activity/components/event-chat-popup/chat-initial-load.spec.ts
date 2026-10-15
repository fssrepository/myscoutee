import { signal } from '@angular/core';
import { EventChatPopupComponent } from './event-chat-popup.component';

describe('Shared chat lazy initial load', () => {
  const chat = { id: 'chat', memberIds: [] };
  const request = { chatId: 'chat', serviceChat: { serviceContext: 'groupSupport', announcementId: 'announcement' } };
  let view: any;
  beforeEach(() => {
    view = Object.assign(Object.create(EventChatPopupComponent.prototype), {
      session: () => ({ request, item: chat }), loadedSessionKey: 'session', destroyed: false,
      chatLoadError: signal(null), cdr: { markForCheck: vi.fn() },
      chatsService: { ensureServiceChat: vi.fn().mockResolvedValue(chat), loadChatMessagesResult: vi.fn().mockResolvedValue({ items: [], total: 0 }) },
      patchCurrentEventChatHeader: vi.fn(), applyChatThreadMessagesPage: vi.fn(page => page),
      rebuildVisibleReadReceipts: vi.fn(), syncEventChatSummaryFromLatestMessage: vi.fn(),
      applyLoadedChatReadReceipt: vi.fn(), startLiveChatUpdates: vi.fn(), emptyChatThreadPage: () => ({ items: [], total: 0 })
    });
  });
  it('resolves the service chat inside the lazy loader before loading messages', async () => {
    await view.loadInitialChatThreadPage({ page: 0 }, 'session');
    expect(view.chatsService.ensureServiceChat).toHaveBeenCalledWith(request.serviceChat);
    expect(view.chatsService.loadChatMessagesResult).toHaveBeenCalledWith(chat, { page: 0 });
    expect(view.patchCurrentEventChatHeader).toHaveBeenCalledOnce();
    expect(view.chatLoadError()).toBeNull();
  });
  it('loads known chats without an ensure request', async () => {
    view.session = () => ({ request: { chatId: 'chat' }, item: chat });
    await view.loadInitialChatThreadPage({ page: 0 }, 'session');
    expect(view.chatsService.ensureServiceChat).not.toHaveBeenCalled();
    expect(view.chatsService.loadChatMessagesResult).toHaveBeenCalledOnce();
  });
  it.each(['ensure', 'messages'])('shows %s failures in the shared list without starting live updates', async failure => {
    if (failure === 'ensure') view.chatsService.ensureServiceChat.mockResolvedValue(null);
    else view.chatsService.loadChatMessagesResult.mockRejectedValue(new Error('Unavailable'));
    await expect(view.loadInitialChatThreadPage({ page: 0 }, 'session')).rejects.toThrow();
    expect(view.chatLoadError()).toBe('chat.load.failed');
    expect(view.startLiveChatUpdates).not.toHaveBeenCalled();
    expect(view.chatInitialLoadPending).toBe(false);
  });
  it('ignores a delayed resolution after closing the popup', async () => {
    let finish!: (value: unknown) => void;
    view.chatsService.ensureServiceChat.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const loading = view.loadInitialChatThreadPage({ page: 0 }, 'session');
    view.loadedSessionKey = null;
    finish(chat);
    await loading;
    expect(view.patchCurrentEventChatHeader).not.toHaveBeenCalled();
    expect(view.chatsService.loadChatMessagesResult).not.toHaveBeenCalled();
  });
});
