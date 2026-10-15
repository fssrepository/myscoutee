import type { FeedbackQueryDto, FeedbackDetailDto, FeedbackReceivedEventDto, FeedbackNoteRequestDto, FeedbackPageQueryDto, FeedbackPageResultDto, FeedbackStatDto, FeedbackStatQueryDto, FeedbackStateDto } from '../../../contracts/feedback/feedback.interface';
import { Injectable,inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';
import { LocalFeedbackService } from '../../../local/source/services/feedback/feedback.service';
import { HttpFeedbackService } from '../../../http/services/feedback/feedback.service';
import type { IFeedbackService,FeedbackBucket,FeedbackCommand } from '../../../contracts/feedback/feedback.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
@Injectable({providedIn:'root'})
export class FeedbackService extends BaseRouteModeService implements IFeedbackService {
  private readonly local=inject(LocalFeedbackService);
  private readonly http=inject(HttpFeedbackService);
  private get adapter():IFeedbackService{return this.resolveRouteService('/feedback',this.local,this.http);}
  action(id:string,command:FeedbackCommand){return this.adapter.action(id,command);}
  stats(userId:string,provider:string,signal?:AbortSignal){return this.adapter.stats(userId,provider,signal);}


queryStates(userId: string): Promise<FeedbackStateDto[]> {
    return this.adapter.queryStates(userId);
  }

queryReceived(userId: string): Promise<FeedbackReceivedEventDto[]> {
    return this.adapter.queryReceived(userId);
  }

loadPage(query: FeedbackPageQueryDto): Promise<FeedbackPageResultDto> {
    return this.adapter.loadPage(query);
  }

loadStatistics(query: FeedbackStatQueryDto): Promise<FeedbackStatDto> {
    return this.adapter.loadStatistics(query);
  }

loadDetail(query: FeedbackQueryDto): Promise<FeedbackDetailDto> {
    return this.adapter.loadDetail(query);
  }

submit(userId: string, request: FeedbackDetailDto): Promise<FeedbackDetailDto> {
    return this.adapter.submit(userId, request);
  }

saveNote(request: FeedbackNoteRequestDto): Promise<void> {
    return this.adapter.saveNote(request);
  }

remove(userId: string, eventId: string): Promise<void> {
    return this.adapter.remove(userId, eventId);
  }

restore(userId: string, eventId: string): Promise<void> {
    return this.adapter.restore(userId, eventId);
  }
}
