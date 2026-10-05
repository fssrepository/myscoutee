import announcements from '../data/community-announcements.json';
import type { UserRecord } from '../../source/entity/user.entity';
import type { CommunityAnnouncementRecord } from '../../source/entity/community-announcement.entity';
export class SeedCommunityAnnouncementsBuilder {
  static build(users:readonly UserRecord[]):CommunityAnnouncementRecord[] {
    const ids=new Map(users.filter(u=>!u.workspaceGroupId).map(u=>[u.name,u.id]));
    return announcements.map(({authorName,...a})=>{
      const authorAccountId=ids.get(authorName);if(!authorAccountId)throw new Error(`Missing Community actor: ${authorName}`);
      return {...a,authorAccountId} as CommunityAnnouncementRecord;
    });
  }
}
