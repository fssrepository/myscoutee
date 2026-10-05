import { Injectable } from '@angular/core';
import type { LandingSlideDto } from '../../../contracts/content.interface';
import { WORK_BASE_GROUP_ID, COMMUNITY_BASE_GROUP_ID, isBaseGroupId } from '../../../contracts/group-type';

@Injectable({ providedIn: 'root' })
export class LocalLandingContentRepository {
  async querySlides(groupId: string | null): Promise<LandingSlideDto[]> {
    if (groupId !== null && !isBaseGroupId(groupId)) throw new Error('Landing group not found');
    const data = groupId === COMMUNITY_BASE_GROUP_ID
      ? await import('../../seed/data/landing-slides-community.json') : groupId === WORK_BASE_GROUP_ID
      ? await import('../../seed/data/landing-slides-work.json')
      : await import('../../seed/data/landing-slides-dating.json');
    return data.default.map(slide => ({ ...slide })) as LandingSlideDto[];
  }
}
