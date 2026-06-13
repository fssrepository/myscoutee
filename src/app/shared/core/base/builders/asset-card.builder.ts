import type * as AppTypes from '../models';
import { AssetDefaultsBuilder } from './asset-defaults.builder';
import { PricingBuilder } from './pricing.builder';

import type * as AppDTOs from '../dto';
import type * as AppConstants from '../../common/constants';
export class AssetCardBuilder {
  static buildEmptyAssetForm(type: AppConstants.AssetType): Omit<AppDTOs.AssetCardDTO, 'id' | 'requests'> {
    return {
      type,
      title: '',
      subtitle: '',
      category: AssetDefaultsBuilder.defaultCategory(type),
      city: '',
      capacityTotal: type === 'Supplies' ? 6 : 4,
      quantity: this.defaultQuantity(type),
      details: '',
      imageUrl: '',
      sourceLink: '',
      routes: this.normalizeAssetRoutes(type, []),
      topics: [],
      policies: [],
      pricing: PricingBuilder.createDefaultPricingConfig('asset')
    };
  }

  static normalizeAssetRoutes(type: AppConstants.AssetType, routes: string[] | undefined | null): string[] {
    if (type === 'Supplies') {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === 'Accommodation') {
      return cleaned.length > 0 ? [cleaned[0]] : [''];
    }
    return cleaned.length > 0 ? cleaned : [''];
  }

  static normalizeAssetImageLink(
    type: AppConstants.AssetType,
    imageUrl: string | null | undefined,
    options: { fallbackImageUrl?: string | null } = {}
  ): string {
    const trimmed = (imageUrl ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return `${options.fallbackImageUrl ?? ''}`.trim();
    }
    return trimmed;
  }

  static normalizeAssetSourceLink(
    sourceLink: string | null | undefined,
    fallbackImageUrl: string
  ): string {
    const trimmed = (sourceLink ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return fallbackImageUrl.trim();
    }
    return trimmed;
  }

  static normalizeAssetMedia(
    card: AppDTOs.AssetCardDTO,
    options: { fallbackImageUrl?: string | null } = {}
  ): AppDTOs.AssetCardDTO {
    const imageUrl = this.normalizeAssetImageLink(card.type, card.imageUrl, options);
    const sourceLink = this.normalizeAssetSourceLink(card.sourceLink, imageUrl);
    return {
      ...card,
      imageUrl,
      sourceLink,
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: PricingBuilder.clonePricingConfig(card.pricing ?? PricingBuilder.createDefaultPricingConfig('asset'))
    };
  }

  static normalizeAssetMediaCards(
    cards: readonly AppDTOs.AssetCardDTO[],
    options: { fallbackImageUrl?: (card: AppDTOs.AssetCardDTO) => string | null | undefined } = {}
  ): AppDTOs.AssetCardDTO[] {
    return cards.map(card => this.normalizeAssetMedia(card, {
      fallbackImageUrl: options.fallbackImageUrl?.(card) ?? ''
    }));
  }

  static capacityLabel(card: AppDTOs.AssetCardDTO): string {
    return `${this.capacityValue(card)}`;
  }

  static quantityLabel(card: AppDTOs.AssetCardDTO): string {
    return `${this.quantityValue(card)}`;
  }

  static capacityValue(card: Pick<AppDTOs.AssetCardDTO, 'capacityTotal'>): number {
    return Math.max(1, Math.trunc(Number(card.capacityTotal) || 0));
  }

  static quantityValue(card: Pick<AppDTOs.AssetCardDTO, 'type' | 'quantity' | 'capacityTotal'>): number {
    return this.normalizeQuantity(card.type, card.quantity, card.capacityTotal);
  }

  static storedQuantityValue(
    card: Pick<AppDTOs.AssetCardDTO, 'type' | 'capacityTotal'> & { quantity: unknown }
  ): number {
    const parsed = Math.trunc(Number(card.quantity));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return this.normalizeQuantity(card.type, card.quantity, card.capacityTotal);
  }

  static defaultQuantity(type: AppConstants.AssetType): number {
    return type === 'Supplies' ? 6 : 1;
  }

  static normalizeQuantity(
    type: AppConstants.AssetType,
    value: unknown,
    capacityFallback: unknown = null
  ): number {
    const parsed = Math.trunc(Number(value) || 0);
    if (parsed > 0) {
      return parsed;
    }
    if (type === 'Supplies') {
      return Math.max(1, Math.trunc(Number(capacityFallback) || 0));
    }
    return this.defaultQuantity(type);
  }

  static primaryLocation(card: AppDTOs.AssetCardDTO): string {
    if (card.type !== 'Accommodation') {
      return '';
    }
    return (card.routes ?? [])
      .map(route => route.trim())
      .find(route => route.length > 0)
      ?? card.city.trim();
  }

  static canOpenMap(card: AppDTOs.AssetCardDTO): boolean {
    return card.type === 'Accommodation' && this.primaryLocation(card).length > 0;
  }

  static isGoogleMapsLikeLink(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes('google.com/maps')
      || normalized.includes('maps.google.')
      || normalized.includes('goo.gl/maps');
  }

  private static isLegacyGeneratedAssetImage(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes('loremflickr.com/');
  }
}
