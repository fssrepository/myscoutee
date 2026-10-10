import { Injectable,inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { LocalServiceFeedbackService } from '../../local/source/services/service-feedback.service';
import { HttpServiceFeedbackService } from '../../http/services/service-feedback.service';
import type { IServiceFeedbackService,ServiceFeedbackBucket,ServiceFeedbackCommand } from '../../contracts/service-feedback.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
@Injectable({providedIn:'root'})
export class ServiceFeedbackService extends BaseRouteModeService implements IServiceFeedbackService {
  private readonly local=inject(LocalServiceFeedbackService);
  private readonly http=inject(HttpServiceFeedbackService);
  private get adapter():IServiceFeedbackService{return this.resolveRouteService('/community-cases',this.local,this.http);}
  page(userId:string,query:ListQuery<{bucket:ServiceFeedbackBucket}>,signal?:AbortSignal){return this.adapter.page(userId,query,signal);}
  action(id:string,command:ServiceFeedbackCommand){return this.adapter.action(id,command);}
  stats(userId:string,provider:string,signal?:AbortSignal){return this.adapter.stats(userId,provider,signal);}
}
