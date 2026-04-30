import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';
import type * as AppTypes from '../../../core/base/models';
import { SHARE_TOKENS_TABLE_NAME } from '../models/share-tokens.model';
import { DemoEventsRepository } from './events.repository';
import { DemoAssetsRepository } from './assets.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoShareTokensRepository {
  private static readonly TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly assetsRepository = inject(DemoAssetsRepository);

  createToken(request: AppTypes.ShareTokenCreateRequest): string {
    const kind = request.kind;
    const entityId = `${request.entityId ?? ''}`.trim();
    if (!entityId || (kind !== 'event' && kind !== 'asset' && kind !== 'adminHelp')) {
      return '';
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DemoShareTokensRepository.TOKEN_TTL_MS);
    const tokenId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const token = `myscoutee:token:${tokenId}`;
    const record: AppTypes.ShareTokenRecord = {
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

  resolveToken(token: string, userId: string): AppTypes.ShareTokenResolvedItem | null {
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
    if (assetType !== 'Car' && assetType !== 'Accommodation' && assetType !== 'Supplies') {
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
      description: asset.details || asset.subtitle,
      imageUrl: asset.imageUrl,
      url: asset.sourceLink
    };
  }

  private isExpired(record: AppTypes.ShareTokenRecord | null | undefined): boolean {
    if (!record) {
      return true;
    }
    const expiresAtMs = Date.parse(record.expiresAtIso);
    return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
  }
}
