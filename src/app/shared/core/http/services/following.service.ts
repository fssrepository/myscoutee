import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { FollowingChangeResult, IFollowingService } from '../../contracts/following.interface';
import type { ActivityMemberDTO } from '../../contracts/activity.interface';
@Injectable({ providedIn: 'root' })
export class HttpFollowingService implements IFollowingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl ?? '/api'}/activities/events/following`;
  change(userId: string, organizerId: string, followed: boolean): Promise<FollowingChangeResult> {
    return firstValueFrom(this.http.post<FollowingChangeResult>(this.url, { userId, organizerId, followed }));
  }
  members(userId: string): Promise<ActivityMemberDTO[]> {
    return firstValueFrom(this.http.get<ActivityMemberDTO[]>(`${this.url}/members`, { params: { userId } }));
  }
}
