import type { RateFilterKey } from '../../contracts/activity.interface';
import type { ChatDTO } from '../../contracts/chat.interface';
import type { AssetType } from '../../common/constants';
import type { AssetCardDTO } from '../dto';

export type RateFilterEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; key: RateFilterKey; label: string };

export type SubEventAssetAssignmentIds = Partial<Record<AssetType, string[]>>;
export type SubEventAssetCardsByType = Partial<Record<AssetType, AssetCardDTO[]>>;

export interface EventChatSession {
  item: ChatDTO;
  openedAtIso: string;
}
