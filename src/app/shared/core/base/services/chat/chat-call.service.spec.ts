import { TestBed } from '@angular/core/testing';
import { ChatCallService } from './chat-call.service';
import { ChatsService } from './chats.service';
import type { ChatCallEvent } from '../../../contracts/chat/chat-call.interface';

describe('Chat call room end ordering', () => {
  let service: ChatCallService;
  let state: { callId: string; selfId: string; invite: ChatCallEvent | null; receive(event: ChatCallEvent): Promise<void> };
  const stop = vi.fn();
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ChatCallService, { provide: ChatsService, useValue: {} }] });
    service = TestBed.inject(ChatCallService);
    state = service as unknown as typeof state;
    stop.mockReset();
    service.localStream.set({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    state.callId = 'room';
    state.invite = { kind: 'invite', callId: 'room', nodeId: 'owned-0', video: false };
  });
  afterEach(() => TestBed.resetTestingModule());

  it.each(['preparing', 'waiting'] as const)('preserves a new %s join when the previous room end arrives first', async status => {
    service.status.set(status);
    state.selfId = '';
    await state.receive({ kind: 'ended', callId: 'room' });
    expect(state.invite).toBeNull();
    expect(state.callId).toBe('room');
    expect(service.status()).toBe(status);
    expect(service.localStream()).not.toBeNull();
    expect(stop).not.toHaveBeenCalled();
  });

  it('releases media and clears an ended room after its roster confirmed membership', async () => {
    state.selfId = 'confirmed-session';
    service.status.set('active');
    await state.receive({ kind: 'ended', callId: 'room' });
    expect(stop).toHaveBeenCalledOnce();
    expect(service.localStream()).toBeNull();
    expect(service.status()).toBe('idle');
    expect(state.callId).toBe('');
  });

  it('dismisses an incoming invitation when its room ended', async () => {
    state.callId = '';
    service.status.set('incoming');
    await state.receive({ kind: 'ended', callId: 'room' });
    expect(state.invite).toBeNull();
    expect(service.status()).toBe('idle');
  });

  it('ignores the end of a different room', async () => {
    state.selfId = 'confirmed-session';
    service.status.set('active');
    await state.receive({ kind: 'ended', callId: 'previous-room' });
    expect(service.status()).toBe('active');
    expect(stop).not.toHaveBeenCalled();
  });
});
