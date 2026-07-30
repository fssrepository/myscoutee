import type { ChatReadAvatar } from '../../../shared/core/contracts/chat.interface';
import { mergeChatReadAvatars } from './chat-message-read-state';

const firstReader: ChatReadAvatar = {
  id: 'reader-1',
  initials: 'R1',
  gender: 'woman'
};

describe('mergeChatReadAvatars', () => {
  it('keeps an early read receipt when a later message acknowledgement has no readers', () => {
    expect(mergeChatReadAvatars([firstReader], [])).toEqual([firstReader]);
  });

  it('unions readers and de-duplicates repeated receipt snapshots', () => {
    const secondReader: ChatReadAvatar = {
      id: 'reader-2',
      initials: 'R2',
      gender: 'man'
    };

    expect(mergeChatReadAvatars([firstReader], [secondReader, firstReader]))
      .toEqual([firstReader, secondReader]);
  });

  it('does not replace useful avatar metadata with an empty stale snapshot', () => {
    expect(mergeChatReadAvatars(
      [{ ...firstReader, imageUrl: '/reader-1.webp' }],
      [{ ...firstReader, initials: '', imageUrl: '' }]
    )).toEqual([{
      ...firstReader,
      imageUrl: '/reader-1.webp'
    }]);
  });
});
