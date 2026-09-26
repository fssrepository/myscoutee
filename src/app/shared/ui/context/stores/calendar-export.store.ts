import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { EventsService } from '../../../core/base/services/events.service';
import { UserProfileStore } from './user-profile.store';
import { DialogStore } from './dialog.store';

@Injectable({ providedIn: 'root' })
export class CalendarExportStore {
  private readonly events = inject(EventsService);
  private readonly profile = inject(UserProfileStore);
  private readonly dialogs = inject(DialogStore);
  private readonly document = inject(DOCUMENT);
  private readonly busy = signal(false);
  readonly downloading = this.busy.asReadonly();

  async download(): Promise<void> {
    if (this.busy()) return;
    const actorId = this.profile.activeUserId();
    if (!actorId) return;
    this.busy.set(true);
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 30_000);
    try {
      const content = await this.events.exportCalendar(abort.signal);
      if (abort.signal.aborted || this.profile.activeUserId() !== actorId) return;
      if (!content) {
        this.dialogs.openNotice('calendar.export.empty', { title: 'calendar.sync' });
        return;
      }
      if (!content.startsWith('BEGIN:VCALENDAR\r\n') || !content.endsWith('END:VCALENDAR\r\n')) {
        throw new Error('Invalid calendar response');
      }
      const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = 'myscoutee-calendar.ics';
      this.document.body.appendChild(anchor);
      try { anchor.click(); }
      finally {
        anchor.remove();
        // Keep the URL alive long enough for mobile download handoff.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch {
      if (this.profile.activeUserId() === actorId) {
        this.dialogs.openInfo('calendar.export.error', { title: 'calendar.sync' });
      }
    } finally {
      clearTimeout(timeout);
      this.busy.set(false);
    }
  }
}
