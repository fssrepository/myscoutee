import { SHARE_TOKENS_TABLE_NAME, type ShareTokenRecord } from '../entity/sharing.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import * as AppConstants from '../../../common/constants';
import type { ShareTokenCreateRequest, ShareTokenResolvedItem } from '../../../contracts/share.interface';

import { LocalEventsRepository } from './events.repository';
import { LocalAssetsRepository } from './assets.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalShareTokensRepository {
  private static readonly TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly assetsRepository = inject(LocalAssetsRepository);

  async flushToIndexedDb(): Promise<void> {
    await this.memoryDb.flushToIndexedDb();
  }

  createToken(request: ShareTokenCreateRequest): string {
    const kind = request.kind;
    const entityId = `${request.entityId ?? ''}`.trim();
    if (!entityId || (kind !== 'event' && kind !== 'asset' && kind !== 'adminHelp')) {
      return '';
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LocalShareTokensRepository.TOKEN_TTL_MS);
    const tokenId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const token = `myscoutee:token:${tokenId}`;
    const record: ShareTokenRecord = {
      token,
      kind,
      entityId,
      assetType: request.assetType ?? null,
      ownerUserId: request.ownerUserId ?? null,
      createdAtIso: now.toISOString(),
      expiresAtIso: expiresAt.toISOString()
    };
    this.memoryDb.write(state => {
      const table = state[SHARE_TOKENS_TABLE_NAME];
      const activeTokens = table.tokens.filter(existingToken => !this.isExpired(table.byToken[existingToken]));
      return {
        ...state,
        [SHARE_TOKENS_TABLE_NAME]: {
          byToken: {
            ...Object.fromEntries(activeTokens.map(existingToken => [existingToken, table.byToken[existingToken]])),
            [token]: record
          },
          tokens: [...activeTokens, token]
        }
      };
    });
    return token;
  }

  ensureAdminHelpToken(request: {
    adminId: string;
    userId: string;
    targetKey: string;
    targetUrl: string;
  }): string {
    const adminId = `${request.adminId ?? ''}`.trim();
    const userId = `${request.userId ?? ''}`.trim();
    const targetKey = `${request.targetKey ?? ''}`.trim();
    const targetUrl = `${request.targetUrl ?? ''}`.trim();
    if (!adminId || !userId || !targetKey || !targetUrl) {
      return '';
    }
    const safeAdminId = adminId.replace(/[^A-Za-z0-9-]/g, '-');
    const targetSuffix = targetKey === 'current' ? '' : `-${targetKey}`;
    const token = `myscoutee:token:admin-help-${safeAdminId}-${userId}${targetSuffix}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LocalShareTokensRepository.TOKEN_TTL_MS);
    const record: ShareTokenRecord = {
      token,
      kind: 'adminHelp',
      entityId: targetUrl,
      ownerUserId: userId,
      createdAtIso: now.toISOString(),
      expiresAtIso: expiresAt.toISOString()
    };
    this.memoryDb.write(state => {
      const table = state[SHARE_TOKENS_TABLE_NAME];
      const existing = table.byToken[token];
      if (existing && !this.isExpired(existing) && existing.entityId === targetUrl) {
        return state;
      }
      return {
        ...state,
        [SHARE_TOKENS_TABLE_NAME]: {
          byToken: {
            ...table.byToken,
            [token]: record
          },
          tokens: table.tokens.includes(token) ? [...table.tokens] : [...table.tokens, token]
        }
      };
    });
    return token;
  }

  resolveToken(token: string, userId: string): ShareTokenResolvedItem | null {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return null;
    }
    const record = this.memoryDb.read()[SHARE_TOKENS_TABLE_NAME].byToken[normalizedToken];
    if (!record || this.isExpired(record)) {
      return null;
    }
    if (record.kind === 'event') {
      const eventRecord = this.eventsRepository.peekKnownItemById(userId, record.entityId);
      if (!eventRecord) {
        return null;
      }
      return {
        kind: 'event',
        entityId: record.entityId,
        title: eventRecord.title,
        subtitle: eventRecord.timeframe,
        description: eventRecord.subtitle,
        imageUrl: eventRecord.imageUrl,
        url: eventRecord.sourceLink
      };
    }
    if (record.kind === 'adminHelp') {
      return {
        kind: 'adminHelp',
        entityId: record.entityId,
        ownerUserId: record.ownerUserId ?? null,
        title: 'Shared help view',
        subtitle: 'MyScoutee support session',
        description: 'The user allowed MyScoutee admin to open their current app view.',
        imageUrl: null,
        url: record.entityId
      };
    }
    const assetType = record.assetType;
    if (!AppConstants.isAssetType(assetType)) {
      return null;
    }
    const asset = this.assetsRepository.peekVisibleAssetById(userId, assetType, record.entityId);
    if (!asset) {
      return null;
    }
    return {
      kind: 'asset',
      entityId: record.entityId,
      assetType,
      ownerUserId: asset.ownerUserId ?? record.ownerUserId ?? null,
      title: asset.title,
      subtitle: [asset.type, asset.city].filter(Boolean).join(' - '),
      description: asset.description || asset.subtitle,
      imageUrl: asset.imageUrl,
      url: ''
    };
  }

  private isExpired(record: ShareTokenRecord | null | undefined): boolean {
    if (!record) {
      return true;
    }
    const expiresAtMs = Date.parse(record.expiresAtIso);
    return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
  }
}
