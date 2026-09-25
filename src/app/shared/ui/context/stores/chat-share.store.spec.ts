import { TestBed } from '@angular/core/testing';
import { ChatsService } from '../../../core/base/services/chats.service';
import type { ChatDTO, ChatMessageDto } from '../../../core/contracts/chat.interface';
import { ChatShareStore } from './chat-share.store';

describe('ChatShareStore', () => {
  const chat = { id: 'chat-1' } as ChatDTO;
  const event = { kind: 'event' as const, entityId: 'event-1', title: 'Event' };
  const oldShare = { id: 'old-message', attachments: [{ type: 'event', entityId: event.entityId, title: event.title }] } as ChatMessageDto;
  let store: ChatShareStore;
  let load: ReturnType<typeof vi.fn>;
  const confirm = () => store.handleMenu({ id: 'chat-share-confirm', item: { id: 'chat-share-confirm' }, sourceEvent: new Event('click') });
  beforeEach(() => {
    load = vi.fn().mockResolvedValue([oldShare]);
    TestBed.configureTestingModule({ providers: [{ provide: ChatsService, useValue: { queryChatSharedMessages: load } }] });
    store = TestBed.inject(ChatShareStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('restores earlier shares without reading the visible message page, and only applies on confirmation', async () => {
    store.open(chat, 'event');
    await Promise.resolve();
    expect(store.selection(event)?.selected).toBe(true);
    store.toggle(event);
    expect(store.applyRequest()).toBeNull();
    confirm();
    expect(store.takeRequest('another-chat')).toBeNull();
    const request = store.takeRequest(chat.id)!;
    expect(request.removals).toEqual(['old-message']);
    expect(request.additions).toEqual([]);
    expect(store.takeRequest(chat.id)).toBeNull();
    store.removed(request, 'old-message');
    store.finish(request, true);
    expect(store.completed()?.id).toBe(request.id);
  });

  it('submits new selections and newly unticked old shares together, with one item per new message', async () => {
    store.open(chat, 'event');
    await Promise.resolve();
    const second = {...event, entityId: 'event-2'};
    const third = {...event, entityId: 'event-3'};
    const cancelled = {...event, entityId: 'never-sent'};
    store.toggle(event);
    store.toggle(second); store.toggle(third);
    store.toggle(cancelled); store.toggle(cancelled);
    confirm();
    const request = store.takeRequest(chat.id)!;
    expect(request.additions).toEqual([second, third]);
    expect(request.removals).toEqual(['old-message']);
    expect(store.busy()).toBe(true);
    store.removed(request, 'old-message');
    store.added(request, second, {id: 'message-2'} as ChatMessageDto);
    store.added(request, third, {id: 'message-3'} as ChatMessageDto);
    store.finish(request, true);
    expect(store.changed()).toBe(false);
  });

  it('does not re-send additions already acknowledged before a partial failure', async () => {
    store.open(chat, 'event');
    await Promise.resolve();
    const second = { ...event, entityId: 'event-2' };
    const third = { ...event, entityId: 'event-3' };
    store.toggle(second); store.toggle(third); confirm();
    const request = store.takeRequest(chat.id)!;
    store.added(request, second, { id: 'new-message' } as ChatMessageDto);
    store.finish(request, false);
    confirm();
    expect(store.takeRequest(chat.id)?.additions).toEqual([third]);
  });

  it('ignores a late selection load from a closed or replaced picker', async () => {
    let resolve!: (messages: ChatMessageDto[]) => void;
    load.mockReturnValueOnce(new Promise<ChatMessageDto[]>(done => { resolve = done; }));
    store.open(chat, 'event');
    store.close('event');
    load.mockResolvedValueOnce([]);
    store.open({ id: 'other-chat' } as ChatDTO, 'asset');
    await Promise.resolve();
    resolve([oldShare]);
    await Promise.resolve();
    expect(store.session()?.chat.id).toBe('other-chat');
    expect(store.selected().size).toBe(0);
  });

  it('keeps selection disabled when its persisted baseline could not be loaded', async () => {
    load.mockRejectedValueOnce(new Error('offline'));
    store.open(chat, 'event');
    await Promise.resolve();
    store.toggle(event); confirm();
    expect(store.error()).toBe(true);
    expect(store.selection(event)?.disabled).toBe(true);
    expect(store.applyRequest()).toBeNull();
  });
});
