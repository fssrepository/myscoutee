import { HttpParams } from '@angular/common/http';
import { FeedbackDetailDto, FeedbackPageResultDto } from '../../../contracts/feedback/feedback.interface';
import type { FeedbackQueryDto, FeedbackReceivedEventDto, FeedbackNoteRequestDto, FeedbackPageQueryDto, FeedbackStatDto, FeedbackStatQueryDto, FeedbackStateDto } from '../../../contracts/feedback/feedback.interface';
import { Injectable,inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import type { IFeedbackService,FeedbackEvaluationItem,FeedbackBucket,FeedbackCommand,FeedbackStats } from '../../../contracts/feedback/feedback.interface';
import type { ListQuery, PageResult } from '@fssrepository/myscoutee-components';
@Injectable({providedIn:'root'})
export class HttpFeedbackService implements IFeedbackService {
  private readonly http=inject(HttpClient);
  private readonly url=`${environment.apiBaseUrl??'/api'}/feedback/evaluations`;
  async action(id:string,command:FeedbackCommand):Promise<void>{await firstValueFrom(this.http.post<void>(`${this.url}/${encodeURIComponent(id)}`,command));}
  async stats(userId:string,provider:string,signal?:AbortSignal){signal?.throwIfAborted();const result=await firstValueFrom(this.http.get<FeedbackStats>(`${this.url}/stats/${encodeURIComponent(provider)}`,{params:{userId}}));signal?.throwIfAborted();return result;}


private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
async queryStates(userId: string): Promise<FeedbackStateDto[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<FeedbackStateDto[] | null>(`${this.apiBaseUrl}/feedback`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      return Array.isArray(response)
        ? response.map(item => ({
            eventId: item.eventId?.trim() ?? '',
            removed: Boolean(item.removed),
            submittedAtIso: item.submittedAtIso?.trim() ?? '',
            removedAtIso: item.removedAtIso?.trim() ?? '',
            organizerNote: item.organizerNote?.trim() ?? '',
            answersByCardId: this.cloneFeedbackAnswersByCardId(item.answersByCardId)
          })).filter(item => item.eventId)
        : [];
    } catch (error) {
      // Callers that own retry/cache behavior must see read failures; [] is
      // reserved for a successful response with no event records.
      throw error;
    }
  }

async queryReceived(userId: string): Promise<FeedbackReceivedEventDto[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
          .get<FeedbackReceivedEventDto[] | null>(`${this.apiBaseUrl}/feedback/received`, {
            params: new HttpParams().set('userId', normalizedUserId)
          })
          .toPromise();
      return Array.isArray(response)
        ? response.map(item => ({
            eventId: item.eventId?.trim() ?? '',
            entries: (item.entries ?? []).map(entry => ({
              viewerUserId: entry.viewerUserId?.trim() ?? '',
              viewerName: entry.viewerName?.trim() ?? '',
              viewerInitials: entry.viewerInitials?.trim() ?? '',
              viewerGender: (entry.viewerGender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
              viewerImageUrl: entry.viewerImageUrl?.trim() ?? '',
              eventId: entry.eventId?.trim() ?? item.eventId?.trim() ?? '',
              submittedAtIso: entry.submittedAtIso?.trim() ?? '',
              updatedAtIso: entry.updatedAtIso?.trim() ?? '',
              organizerNote: entry.organizerNote?.trim() ?? '',
              answers: Object.values(this.cloneFeedbackAnswersByCardId(
                Object.fromEntries((entry.answers ?? []).map(answer => [answer.cardId ?? '', answer]))
              ))
            })).filter(entry => entry.viewerUserId && entry.eventId)
          })).filter(item => item.eventId)
        : [];
    } catch {
      return [];
    }
  }

async loadPage(query: FeedbackPageQueryDto): Promise<FeedbackPageResultDto> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return new FeedbackPageResultDto();
    }
    const response = await this.http
        .post<FeedbackPageResultDto | null>(`${this.apiBaseUrl}/feedback/page`, {
          userId: normalizedUserId,
          campaignId: query.campaignId,
          filter: query.filter,
          page: Math.max(0, Math.trunc(Number(query.page) || 0)),
          pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1))
        })
        .toPromise();
    return new FeedbackPageResultDto(response);
  }

async loadStatistics(query: FeedbackStatQueryDto): Promise<FeedbackStatDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return this.emptyFeedbackStat(normalizedEventId);
    }
    try {
      const response = await this.http
        .post<Partial<FeedbackStatDto> | null>(`${this.apiBaseUrl}/feedback/stat`, {
          userId: normalizedUserId,
          eventId: normalizedEventId
        })
        .toPromise();
      return this.normalizeFeedbackStat(response, normalizedEventId);
    } catch {
      return this.emptyFeedbackStat(normalizedEventId);
    }
  }

async loadDetail(query: FeedbackQueryDto): Promise<FeedbackDetailDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return new FeedbackDetailDto({ eventId: normalizedEventId });
    }
    try {
      const response = await this.http
        .post<FeedbackDetailDto | null>(`${this.apiBaseUrl}/feedback/detail`, {
          userId: normalizedUserId,
          eventId: normalizedEventId
        })
        .toPromise();
      return new FeedbackDetailDto({
        ...(response ?? {}),
        eventId: response?.eventId?.trim() || normalizedEventId
      });
    } catch {
      return new FeedbackDetailDto({ eventId: normalizedEventId });
    }
  }

async submit(userId: string, request: FeedbackDetailDto): Promise<FeedbackDetailDto> {
    const normalizedUserId = userId.trim();
    const feedback = new FeedbackDetailDto(request);
    if (!normalizedUserId || !feedback.eventId || feedback.cards.length === 0) {
      throw new Error('A feedback user, event, and at least one answer are required.');
    }
    const response = await this.http
      .post<FeedbackDetailDto | null>(`${this.apiBaseUrl}/feedback/submit`, {
        userId: normalizedUserId,
        feedback
      })
      .toPromise();
    const persisted = new FeedbackDetailDto(response);
    if (persisted.eventId !== feedback.eventId || !persisted.submittedAtIso || persisted.cards.length === 0) {
      throw new Error('The server did not confirm persisted feedback.');
    }
    return persisted;
  }

async saveNote(request: FeedbackNoteRequestDto): Promise<void> {
    await this.postVoid('/feedback/note', request);
  }

async remove(userId: string, eventId: string): Promise<void> {
    await this.postVoid('/feedback/remove', { userId: userId.trim(), eventId: eventId.trim() });
  }

async restore(userId: string, eventId: string): Promise<void> {
    await this.postVoid('/feedback/restore', { userId: userId.trim(), eventId: eventId.trim() });
  }

private normalizeFeedbackStat(
    response: Partial<FeedbackStatDto> | null | undefined,
    fallbackEventId: string
  ): FeedbackStatDto {
    const eventId = response?.eventId?.trim() || fallbackEventId;
    const sections = (response?.sections ?? [])
      .map(section => {
        const key = section?.key;
        if (key !== 'overall' && key !== 'improve' && key !== 'traits') {
          return null;
        }
        return {
          key,
          responseCount: Math.max(0, Math.trunc(Number(section.responseCount) || 0)),
          options: (section.options ?? [])
            .map(option => ({
              key: option.key?.trim() ?? '',
              count: Math.max(0, Math.trunc(Number(option.count) || 0))
            }))
            .filter(option => option.key.length > 0 && option.count > 0)
        };
      })
      .filter((section): section is FeedbackStatDto['sections'][number] => Boolean(section));
    const maxSectionResponses = sections.reduce((max, section) => Math.max(max, section.responseCount), 0);
    return {
      eventId,
      totalResponses: Math.max(0, Math.trunc(Number(response?.totalResponses) || maxSectionResponses)),
      sections
    };
  }

private emptyFeedbackStat(eventId: string): FeedbackStatDto {
    return {
      eventId: eventId.trim(),
      totalResponses: 0,
      sections: []
    };
  }

private async postVoid(route: string, payload: unknown): Promise<void> {
    try {
      await this.http.post<void>(`${this.apiBaseUrl}${route}`, payload).toPromise();
    } catch {
      // Keep UI optimistic until concrete backend endpoints land.
    }
  }

private cloneFeedbackAnswersByCardId(
    answersByCardId: FeedbackStateDto['answersByCardId']
  ): NonNullable<FeedbackStateDto['answersByCardId']> {
    const next: NonNullable<FeedbackStateDto['answersByCardId']> = {};
    for (const [cardId, answer] of Object.entries(answersByCardId ?? {})) {
      const normalizedCardId = cardId.trim();
      if (!normalizedCardId || !answer) {
        continue;
      }
      next[normalizedCardId] = {
        ...answer,
        cardId: answer.cardId?.trim() || normalizedCardId,
        eventId: answer.eventId?.trim() ?? '',
        kind: answer.kind === 'attendee' ? 'attendee' : 'event',
        targetUserId: answer.targetUserId?.trim() || null,
        targetRole: answer.targetRole === 'Admin' || answer.targetRole === 'Manager' ? answer.targetRole : 'Member',
        primaryValue: answer.primaryValue?.trim() ?? '',
        secondaryValue: answer.secondaryValue?.trim() ?? '',
        eventComment: answer.kind === 'event' ? answer.eventComment?.trim() ?? '' : '',
        personalityTraitIds: (answer.personalityTraitIds ?? []).map(traitId => traitId.trim()).filter(Boolean),
        tags: (answer.tags ?? []).map(tag => tag.trim()).filter(Boolean),
        submittedAtIso: answer.submittedAtIso?.trim() ?? ''
      };
    }
    return next;
  }
}
