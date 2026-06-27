import { AssetDefaultsBuilder } from './asset-defaults.builder';
import { PricingBuilder } from './pricing.builder';

import type * as AppDTOs from '../../contracts';
import type * as AppConstants from '../../common/constants';

export type AssetCardFormValue = Omit<AppDTOs.AssetCardDTO, 'id' | 'requests'>;

export class AssetCardBuilder {
  static buildEmptyAssetForm(type: AppConstants.AssetType): AssetCardFormValue {
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

  static buildAssetFormFromCard(card: AppDTOs.AssetCardDTO): AssetCardFormValue {
    const imageUrl = this.normalizeAssetLink(card.imageUrl);
    const sourceLink = this.normalizeAssetLink(card.sourceLink, imageUrl);
    return {
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: AssetDefaultsBuilder.normalizeCategory(card.type, card.category),
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: card.quantity,
      details: card.details,
      imageUrl,
      sourceLink,
      routes: this.normalizeAssetRoutes(card.type, card.routes),
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: PricingBuilder.clonePricingConfig(card.pricing ?? PricingBuilder.createDefaultPricingConfig('asset'))
    };
  }

  static buildAssetSavePayload(
    assetForm: AssetCardFormValue,
    resolvedImageUrl: string | null | undefined = null
  ): AssetCardFormValue {
    const title = assetForm.title.trim();
    const city = assetForm.city.trim();
    const routes = this.normalizeAssetRoutes(assetForm.type, assetForm.routes);
    const accommodationLocation = routes.find(stop => stop.trim().length > 0)?.trim() || '';
    const imageUrl = this.normalizeAssetLink(resolvedImageUrl || assetForm.imageUrl);
    const sourceLink = this.normalizeAssetLink(assetForm.sourceLink, imageUrl);
    return {
      type: assetForm.type,
      title,
      subtitle: assetForm.subtitle.trim(),
      category: AssetDefaultsBuilder.normalizeCategory(assetForm.type, assetForm.category),
      city: assetForm.type === 'Accommodation' ? accommodationLocation : city,
      capacityTotal: Math.max(1, Number(assetForm.capacityTotal) || (assetForm.type === 'Supplies' ? 6 : 4)),
      quantity: this.normalizeQuantity(assetForm.type, assetForm.quantity, assetForm.capacityTotal),
      details: assetForm.details.trim(),
      imageUrl,
      sourceLink,
      routes,
      topics: [...(assetForm.topics ?? [])],
      policies: this.normalizePolicies(assetForm.policies),
      pricing: PricingBuilder.compactPricingConfig(
        assetForm.pricing ?? PricingBuilder.createDefaultPricingConfig('asset'),
        { context: 'asset', allowSlotFeatures: false }
      )
    };
  }

  static visibilityFromCard(card: Pick<AppDTOs.AssetCardDTO, 'visibility'>): AppConstants.EventVisibility {
    return card.visibility === 'Friends only'
      ? 'Friends only'
      : card.visibility === 'Invitation only'
        ? 'Invitation only'
        : 'Public';
  }

  static activeAssetTypeFromFilter(filter: AppConstants.AssetFilterType): AppConstants.AssetType {
    if (filter === 'Accommodation') {
      return 'Accommodation';
    }
    if (filter === 'Supplies') {
      return 'Supplies';
    }
    return 'Car';
  }

  static cloneCard(card: AppDTOs.AssetCardDTO): AppDTOs.AssetCardDTO {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => this.cloneRequest(request)),
      menuActions: [...(card.menuActions ?? [])]
    };
  }

  static cloneCards(cards: readonly AppDTOs.AssetCardDTO[]): AppDTOs.AssetCardDTO[] {
    return cards.map(card => this.cloneCard(card));
  }

  static cloneRequest(request: AppDTOs.AssetMemberRequestDTO): AppDTOs.AssetMemberRequestDTO {
    return {
      ...request,
      menuActions: [...(request.menuActions ?? [])],
      booking: request.booking
        ? {
            ...request.booking,
            acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
          }
        : null
    };
  }

  static normalizeAssetStatus(status: string | null | undefined): string {
    const normalized = `${status ?? ''}`.trim();
    switch (normalized) {
      case 'active':
        return 'A';
      case 'under-review':
      case 'under review':
        return 'UR';
      case 'blocked':
        return 'B';
      case 'deleted':
        return 'D';
      case 'inactive':
        return 'I';
      case 'trashed':
      case 'trash':
        return 'T';
      default:
        return normalized || 'A';
    }
  }

  static restoredAssetStatus(_card: AppDTOs.AssetCardDTO): string {
    return 'A';
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

  static normalizeAssetLink(
    value: string | null | undefined,
    fallbackLink: string | null | undefined = ''
  ): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return `${fallbackLink ?? ''}`.trim();
    }
    return trimmed;
  }

  static normalizeAssetMedia(
    card: AppDTOs.AssetCardDTO,
    options: { fallbackImageUrl?: string | null } = {}
  ): AppDTOs.AssetCardDTO {
    const imageUrl = this.normalizeAssetLink(card.imageUrl, options.fallbackImageUrl);
    const sourceLink = this.normalizeAssetLink(card.sourceLink, imageUrl);
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

  private static normalizePolicies(
    policies: readonly AppDTOs.EventPolicyItemDTO[] | null | undefined
  ): AppDTOs.EventPolicyItemDTO[] {
    return (policies ?? [])
      .map(item => ({
        id: `${item.id ?? ''}`.trim(),
        title: `${item.title ?? ''}`.trim(),
        description: `${item.description ?? ''}`.trim(),
        required: item.required !== false
      }))
      .filter(item => item.id || item.title || item.description);
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
