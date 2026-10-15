import { LocalCommunityAnnouncementsRepository } from '../../../source/repositories/community/community-announcements.repository';
import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../../common/app.db';
import { SeedCommunityAnnouncementsBuilder } from '../../builders/community/community-announcements-seed.builder';
@Injectable({providedIn:'root'})
export class SeedCommunityAnnouncementsRepository {
  private readonly db=inject(LocalMemoryDb);
  seedDefaults():boolean {
    const state=this.db.read(), seed=SeedCommunityAnnouncementsBuilder.build(state.users.ids.map(id=>state.users.byId[id]));
    const rows=seed.filter(a=>!state.communityAnnouncements.byId[a.id]);
    const retained=state.communityAnnouncements.ids.map(id=>state.communityAnnouncements.byId[id]).filter(a=>!a.voteCounterOwners || !a.announcementCounterOwners);
    if(!rows.length&&!retained.length)return false;
    this.db.write(s=>[...retained,...rows].reduce((next,a)=>LocalCommunityAnnouncementsRepository.withVoteCounterWrite(next,a),s));return true;
  }
}
