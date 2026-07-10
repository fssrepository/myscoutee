import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../../common/app.db';
import type { AdminModerationStore } from '../../../contracts/admin.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminModerationRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async whenReady(): Promise<void> {
    await this.memoryDb.whenReady();
  }

  async readStore(): Promise<AdminModerationStore | null> {
    return await this.memoryDb.readIndexedDbTableEntry<AdminModerationStore>(APP_INDEXED_DB_KEYS.adminModeration);
  }

  async writeStore(store: AdminModerationStore): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminModeration, store);
  }

  async setReportResolved(
    reportId: string,
    adminUserId: string,
    resolvedAtIso: string | null
  ): Promise<AdminModerationStore | null> {
    const normalizedReportId = `${reportId ?? ''}`.trim();
    if (!normalizedReportId) {
      return await this.readStore();
    }
    const store = await this.readStore();
    if (!store) {
      return null;
    }
    const next: AdminModerationStore = {
      ...store,
      reports: (store.reports ?? []).map(report => report.id === normalizedReportId
        ? {
          ...report,
          resolvedAtIso,
          resolvedByAdminUserId: resolvedAtIso ? adminUserId : null
        }
        : report),
      feedback: [...(store.feedback ?? [])]
    };
    await this.writeStore(next);
    return next;
  }

  async setReportWarned(
    reportId: string,
    adminUserId: string,
    warnedAtIso: string
  ): Promise<AdminModerationStore | null> {
    const normalizedReportId = `${reportId ?? ''}`.trim();
    if (!normalizedReportId) {
      return await this.readStore();
    }
    const store = await this.readStore();
    if (!store) {
      return null;
    }
    const next: AdminModerationStore = {
      ...store,
      reports: (store.reports ?? []).map(report => report.id === normalizedReportId
        ? {
          ...report,
          warnedAtIso,
          warnedByAdminUserId: adminUserId
        }
        : report),
      feedback: [...(store.feedback ?? [])]
    };
    await this.writeStore(next);
    return next;
  }

  async setFeedbackResolved(
    feedbackId: string,
    adminUserId: string,
    resolvedAtIso: string | null
  ): Promise<AdminModerationStore | null> {
    const normalizedFeedbackId = `${feedbackId ?? ''}`.trim();
    if (!normalizedFeedbackId) {
      return await this.readStore();
    }
    const store = await this.readStore();
    if (!store) {
      return null;
    }
    const next: AdminModerationStore = {
      ...store,
      reports: [...(store.reports ?? [])],
      feedback: (store.feedback ?? []).map(item => item.id === normalizedFeedbackId
        ? {
          ...item,
          resolvedAtIso,
          resolvedByAdminUserId: resolvedAtIso ? adminUserId : null
        }
        : item)
    };
    await this.writeStore(next);
    return next;
  }
}
