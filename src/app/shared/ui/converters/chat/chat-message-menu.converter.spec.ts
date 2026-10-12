import { describe, expect, it } from 'vitest';
import type { ChatMessageDto } from '../../../core/contracts/chat/chat.interface';
import { ChatMessageMenuConverter } from './chat-message-menu.converter';

const message: ChatMessageDto = {
  id: 'message-1', sender: 'Alex', senderAvatar: {id:'alex',initials:'A',gender:'man'},
  text: 'Hello', time: '12:00', sentAtIso: '2026-10-12T10:00:00Z', mine: true, readBy: []
};
const actions = (value: ChatMessageDto) => ChatMessageMenuConverter.items(value).map(item => item.context?.action);

describe('product-independent chat message menu', () => {
  it('preserves the author actions and their native order', () => {
    expect(actions(message)).toEqual(['reply','edit','unsend','pin']);
  });
  it('does not expose author mutation controls on another participant’s message', () => {
    expect(actions({...message,mine:false})).toEqual(['reply','pin']);
  });
  it('offers resend only for a timed-out outgoing message', () => {
    expect(actions({...message,deliveryState:'timed-out'})).toEqual(['reply','edit','unsend','pin','resend']);
    expect(actions({...message,mine:false,deliveryState:'timed-out'})).toEqual(['reply','pin']);
    expect(actions({...message,deliveryState:'pending'})).not.toContain('resend');
  });
  it('preserves the unpin action and omits product invite/report actions', () => {
    const value={...message,pinnedAtIso:'2026-10-12T10:01:00Z'};
    const items=ChatMessageMenuConverter.items(value);
    expect(items.find(item=>item.context?.action==='pin')?.label).toBe('Unpin');
    expect(items.every(item=>item.context?.message===value)).toBe(true);
    expect(actions(value)).not.toContain('report');
    expect(actions(value)).not.toContain('invite-provider');
  });
});
