import type { CampaignRecord } from '../../source/entity/campaign.entity';
import type { UserRecord } from '../../source/entity/user.entity';
import { WORK_BASE_GROUP_ID } from '../../../contracts/group-type';
import templates from '../data/work-campaigns.json';

export class SeedCampaignsBuilder {
  static build(users: readonly UserRecord[]): CampaignRecord[] {
    const owners = new Map(users.filter(user => user.workspaceGroupId === WORK_BASE_GROUP_ID).map(user => [user.name, user.id]));
    return templates.map(({ ownerName, ...template }) => {
      const ownerUserId = owners.get(ownerName);
      if (!ownerUserId) throw new Error(`Missing Work campaign owner: ${ownerName}`);
      return { ...template, workspaceGroupId: WORK_BASE_GROUP_ID, ownerUserId, imageUrls: [], attachments: [],
        createdAtIso: '2026-10-01T10:00:00.000Z', updatedAtIso: '2026-10-01T10:00:00.000Z', version: 0 } as CampaignRecord;
    });
  }
}
