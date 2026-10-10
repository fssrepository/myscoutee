import { Injectable,inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import type { IServiceFeedbackService,ServiceFeedbackItem,ServiceFeedbackBucket,ServiceFeedbackCommand,ServiceFeedbackStats } from '../../contracts/service-feedback.interface';
import type { ListQuery, PageResult } from '@fssrepository/myscoutee-components';
@Injectable({providedIn:'root'})
export class HttpServiceFeedbackService implements IServiceFeedbackService {
  private readonly http=inject(HttpClient);
  private readonly url=`${environment.apiBaseUrl??'/api'}/community-cases/feedback`;
  async page(userId:string,query:ListQuery<{bucket:ServiceFeedbackBucket}>,signal?:AbortSignal) {
    signal?.throwIfAborted();const result=await firstValueFrom(this.http.get<PageResult<ServiceFeedbackItem,Record<string,number>>>(this.url,{params:{userId,bucket:query.filters?.bucket??'pending',pageSize:query.pageSize,cursor:query.cursor??''}}));signal?.throwIfAborted();return result;
  }
  async action(id:string,command:ServiceFeedbackCommand):Promise<void>{await firstValueFrom(this.http.post<void>(`${this.url}/${encodeURIComponent(id)}`,command));}
  async stats(userId:string,provider:string,signal?:AbortSignal){signal?.throwIfAborted();const result=await firstValueFrom(this.http.get<ServiceFeedbackStats>(`${this.url}/stats/${encodeURIComponent(provider)}`,{params:{userId}}));signal?.throwIfAborted();return result;}
}
