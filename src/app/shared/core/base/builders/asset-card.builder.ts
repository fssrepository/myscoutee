import type * as AppTypes from '../models';
import { PricingBuilder } from './pricing.builder';

export class AssetCardBuilder {
  static buildEmptyAssetForm(type: AppTypes.AssetType): Omit<AppTypes.AssetCard, 'id' | 'requests'> {
    return {
      type,
      title: '',
      subtitle: '',
      city: '',
      capacityTotal: type === 'Supplies' ? 6 : 4,
      details: '',
      imageUrl: '',
      sourceLink: '',
      routes: this.normalizeAssetRoutes(type, []),
      topics: [],
      policies: [],
      pricing: PricingBuilder.createDefaultPricingConfig('asset')
    };
  }

  static normalizeAssetRoutes(type: AppTypes.AssetType, routes: string[] | undefined | null): string[] {
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
    type: AppTypes.AssetType,
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
    card: AppTypes.AssetCard,
    options: { fallbackImageUrl?: string | null } = {}
  ): AppTypes.AssetCard {
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
    cards: readonly AppTypes.AssetCard[],
    options: { fallbackImageUrl?: (card: AppTypes.AssetCard) => string | null | undefined } = {}
  ): AppTypes.AssetCard[] {
    return cards.map(card => this.normalizeAssetMedia(card, {
      fallbackImageUrl: options.fallbackImageUrl?.(card) ?? ''
    }));
  }

  static capacityLabel(card: AppTypes.AssetCard): string {
    return `${Math.max(1, Math.trunc(Number(card.capacityTotal) || 0))}`;
  }

  static primaryLocation(card: AppTypes.AssetCard): string {
    if (card.type !== 'Accommodation') {
      return '';
    }
    return (card.routes ?? [])
      .map(route => route.trim())
      .find(route => route.length > 0)
      ?? card.city.trim();
  }

  static canOpenMap(card: AppTypes.AssetCard): boolean {
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
