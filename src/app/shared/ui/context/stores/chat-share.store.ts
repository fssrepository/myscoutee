import { Injectable, computed, inject, signal } from '@angular/core';
import { ChatsService } from '../../../core/base/services/chats.service';
import type { ChatDTO, ChatMessageDto } from '../../../core/contracts/chat.interface';
import type { ShareTokenCreateRequest } from '../../../core/contracts/share.interface';
import type { AppMenuItem, AppMenuItemSelectEvent } from '../../components/core/menu';
import type { PopupControl } from '../../components/core/popup';
import type { InfoCardData } from '../../components/core/smart-list';

export interface ChatShareItem extends ShareTokenCreateRequest {
  kind: 'event' | 'asset';
  title: string;
}

export interface ChatShareApplyRequest {
  id: string;
  chat: ChatDTO;
  kind: 'event' | 'asset';
  additions: readonly ChatShareItem[];
  removals: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class ChatShareStore {
  private readonly chats = inject(ChatsService);
  readonly session = signal<{ id: string; chat: ChatDTO; kind: 'event' | 'asset' } | null>(null);
  readonly selected = signal<ReadonlyMap<string, ChatShareItem>>(new Map());
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly ready = signal(false);
  readonly applyRequest = signal<ChatShareApplyRequest | null>(null);
  readonly completed = signal<{ id: string; kind: 'event' | 'asset' } | null>(null);
  private readonly shared = signal<ReadonlyMap<string, readonly string[]>>(new Map());
  readonly changed = computed(() => {
    const selected = this.selected();
    const shared = this.shared();
    return selected.size !== shared.size || [...selected.keys()].some(key => !shared.has(key));
  });

  open(chat: ChatDTO, kind: 'event' | 'asset'): void {
    this.session.set({ id: crypto.randomUUID(), chat, kind });
    this.selected.set(new Map());
    this.shared.set(new Map());
    this.ready.set(false);
    this.busy.set(false);
    this.applyRequest.set(null);
    void this.load();
  }

  private async load(): Promise<void> {
    const session = this.session();
    if (!session) return;
    this.loading.set(true);
    this.error.set(false);
    try {
      const messages = await this.chats.queryChatSharedMessages(session.chat, session.kind);
      if (this.session() !== session) return;
      const selected = new Map<string, ChatShareItem>();
      const shared = new Map<string, string[]>();
      for (const message of messages) {
        for (const attachment of message.attachments ?? []) {
          if (attachment.type !== session.kind || !attachment.entityId) continue;
          const item: ChatShareItem = { kind: session.kind, entityId: attachment.entityId,
            assetType: attachment.assetType, ownerUserId: attachment.ownerUserId, title: attachment.title };
          const key = this.key(item);
          selected.set(key, item);
          shared.set(key, [...(shared.get(key) ?? []), message.id]);
        }
      }
      this.selected.set(selected);
      this.shared.set(shared);
      this.ready.set(true);
    } catch {
      if (this.session() === session) this.error.set(true);
    } finally {
      if (this.session() === session) this.loading.set(false);
    }
  }

  active(kind: 'event' | 'asset'): boolean { return this.session()?.kind === kind; }

  toggle(item: ChatShareItem): void {
    if (!this.active(item.kind) || !this.ready() || this.busy()) return;
    const selected = new Map(this.selected());
    const key = this.key(item);
    if (selected.has(key)) selected.delete(key); else selected.set(key, item);
    this.selected.set(selected);
  }

  selection(item: ChatShareItem): InfoCardData['selection'] {
    if (!this.active(item.kind)) return null;
    const selected = this.selected().has(this.key(item));
    return { selected, disabled: !this.ready() || this.busy(),
      ariaLabel: selected ? 'chat.share.remove' : 'chat.share.select' };
  }

  controls<T>(kind: 'event' | 'asset'): PopupControl<T>[] {
    if (!this.active(kind)) return [];
    const items: AppMenuItem<string, T>[] = [];
    if (this.selected().size) items.push({ id: 'chat-share-basket', icon: 'shopping_basket',
      kind: 'branch', palette: 'blue', counter: this.selected().size, ariaLabel: 'chat.share.selected',
      items: [...this.selected()].map(([key, item]) => ({ id: `chat-share-remove:${key}`,
        label: item.title, icon: item.kind === 'event' ? 'event' : 'inventory_2',
        palette: 'blue', surface: 'tinted', removable: true, removeIcon: 'close',
        removeAriaLabel: 'chat.share.remove', disabled: this.busy(), closeOnSelect: false })) });
    items.push({ id: this.error() && !this.ready() ? 'chat-share-retry' : 'chat-share-confirm',
      icon: this.error() && !this.ready() ? 'refresh' : 'done', layout: 'action',
      palette: this.error() ? 'danger' : 'success', ariaLabel: this.error() ? 'chat.share.retry' : 'chat.share.confirm',
      disabled: this.loading() || this.busy() || (!this.error() && !this.changed()),
      progress: this.loading() || this.busy() || this.error()
        ? { state: this.error() ? 'error' : 'loading', shape: 'circle' } : null });
    return [{ id: 'chat-share-controls', kind: 'menu', menuKind: 'inline', items }];
  }

  handleMenu(event: AppMenuItemSelectEvent<string, unknown>): boolean {
    const id = event.item.id;
    if (!id.startsWith('chat-share-')) return false;
    if (id === 'chat-share-retry') { void this.load(); return true; }
    if (id.startsWith('chat-share-remove:') && event.action === 'remove') {
      const item = this.selected().get(id.slice('chat-share-remove:'.length));
      if (item) this.toggle(item);
    }
    if (id === 'chat-share-confirm' && this.ready() && this.changed() && !this.busy()) {
      const session = this.session();
      if (!session) return true;
      this.busy.set(true);
      this.error.set(false);
      this.applyRequest.set({ ...session,
        additions: [...this.selected()].filter(([key]) => !this.shared().has(key)).map(([, item]) => item),
        removals: [...new Set([...this.shared()].filter(([key]) => !this.selected().has(key)).flatMap(([, ids]) => ids))] });
    }
    return true;
  }

  takeRequest(chatId: string): ChatShareApplyRequest | null {
    const request = this.applyRequest();
    if (!request || request.chat.id !== chatId) return null;
    this.applyRequest.set(null);
    return request;
  }

  added(request: ChatShareApplyRequest, item: ChatShareItem, message: ChatMessageDto): void {
    if (this.session()?.id !== request.id) return;
    const shared = new Map(this.shared());
    shared.set(this.key(item), [message.id]);
    this.shared.set(shared);
  }

  removed(request: ChatShareApplyRequest, messageId: string): void {
    if (this.session()?.id !== request.id) return;
    const shared = new Map<string, readonly string[]>();
    for (const [key, ids] of this.shared()) {
      const remaining = ids.filter(id => id !== messageId);
      if (remaining.length) shared.set(key, remaining);
    }
    this.shared.set(shared);
  }

  finish(request: ChatShareApplyRequest, succeeded: boolean): void {
    if (this.session()?.id !== request.id) return;
    this.busy.set(false);
    this.error.set(!succeeded);
    if (succeeded) {
      this.completed.set({ id: request.id, kind: request.kind });
    }
  }

  cancelForChat(chatId: string): void {
    if (!chatId || this.session()?.chat.id !== chatId) return;
    this.session.set(null);
    this.applyRequest.set(null);
    this.busy.set(false);
    this.ready.set(false);
  }

  close(kind: 'event' | 'asset'): void {
    if (!this.active(kind) || this.busy()) return;
    this.session.set(null);
    this.applyRequest.set(null);
  }

  private key(item: ChatShareItem): string { return `${item.kind}:${item.entityId}`; }
}
