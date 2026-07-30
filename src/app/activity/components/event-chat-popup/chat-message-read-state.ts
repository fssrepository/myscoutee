import type { ChatReadAvatar } from '../../../shared/core/contracts/chat.interface';

export function mergeChatReadAvatars(
  ...readerGroups: ReadonlyArray<readonly ChatReadAvatar[] | null | undefined>
): ChatReadAvatar[] {
  const readers: ChatReadAvatar[] = [];
  const readerIndexById = new Map<string, number>();

  for (const readerGroup of readerGroups) {
    for (const reader of readerGroup ?? []) {
      const id = `${reader?.id ?? ''}`.trim();
      if (!id) {
        continue;
      }
      const existingIndex = readerIndexById.get(id);
      if (existingIndex === undefined) {
        readerIndexById.set(id, readers.length);
        readers.push({ ...reader, id });
        continue;
      }

      const existing = readers[existingIndex];
      readers[existingIndex] = {
        ...existing,
        ...reader,
        id,
        initials: `${reader.initials ?? ''}`.trim() || existing.initials,
        gender: reader.gender || existing.gender,
        imageUrl: reader.imageUrl?.trim() || existing.imageUrl
      };
    }
  }

  return readers;
}
