import { clampNumber } from '@fssrepository/myscoutee-components';
import { ActivityResourceBuilder } from '../events/activity-resource.builder';
import { AssetDefaultsBuilder } from './asset-defaults.builder';
import { PricingBuilder } from '../payments/pricing.builder';

import { AssetDto } from '../../../contracts';
import type * as AppDTOs from '../../../contracts';
import * as AppConstants from '../../../common/constants';

export type AssetResourceValue = (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) & {
  routes?: string[];
  topics?: string[];
  policies?: AppDTOs.EventPolicyItemDTO[];
  pricing?: AppDTOs.PricingConfig | null;
};

export type AssetCardFormValue = Omit<AppDTOs.AssetDetailDTO, 'id' | 'requests'>;

export class AssetCardBuilder {

  static assignedAssetCapacities(source: {
    capacityTotal: number;
  }, previous: {
    capacityMin: number;
    capacityMax: number;
    quantity?: number;
  } | undefined) { const capacityLimit = Math.max(0, source.capacityTotal); const capacityMax = clampNumber(Math.trunc(previous?.capacityMax ?? capacityLimit), 0, capacityLimit); const capacityMin = clampNumber(Math.trunc(previous?.capacityMin ?? 0), 0, capacityMax); return { capacityMin, capacityMax, quantity: Math.max(1, Math.trunc(Number(previous?.quantity) || 1)) }; }

  static normalizeRequestIdentity(request: AppDTOs.AssetMemberRequestDTO): Pick<AppDTOs.AssetMemberRequestDTO, 'id' | 'userId' | 'name' | 'initials' | 'gender' | 'status' | 'note' | 'requestKind' | 'requestedAtIso' | 'menuActions'> {
    return {
      id: `${request?.id ?? ''}`.trim(),
      userId: `${request?.userId ?? ''}`.trim() || undefined,
      name: `${request?.name ?? ''}`.trim(),
      initials: `${request?.initials ?? ''}`.trim(),
      gender: (request?.gender === 'woman' ? 'woman' : 'man') as 'woman' | 'man',
      status: (request?.status === 'accepted' ? 'accepted' : 'pending') as AppConstants.AssetRequestStatus,
      note: `${request?.note ?? ''}`.trim(),
      requestKind: (
            request?.requestKind === 'manual'
              ? 'manual'
              : request?.requestKind === 'invite'
                ? 'invite'
                : 'borrow'
          ) as AppConstants.AssetRequestKind,
      requestedAtIso: `${request?.requestedAtIso ?? ''}`.trim() || undefined,
      menuActions: Array.isArray(request?.menuActions)
            ? request.menuActions.map((action: string) => `${action ?? ''}`.trim()).filter((action: string) => action.length > 0)
            : []
    };
  }

  static normalizeDetailBody(card: AppDTOs.AssetDetailDTO | null | undefined): Pick<AppDTOs.AssetDetailDTO, 'details' | 'imageUrl' | 'sourceLink' | 'routes' | 'topics' | 'policiesEnabled' | 'policies' | 'pricing'> {
    return {
      details: card?.details?.trim() ?? '',
      imageUrl: card?.imageUrl?.trim() ?? '',
      sourceLink: card?.sourceLink?.trim() ?? '',
      routes: Array.isArray(card?.routes)
        ? card.routes.map(route => `${route ?? ''}`.trim()).filter(route => route.length > 0)
        : [],
      topics: Array.isArray(card?.topics)
        ? card.topics.map(topic => `${topic ?? ''}`.trim()).filter(topic => topic.length > 0)
        : [],
      policiesEnabled: AssetCardBuilder.assetPoliciesEnabled(card),
      policies: Array.isArray(card?.policies)
        ? card.policies
          .map(item => ({
            id: `${item?.id ?? ''}`.trim(),
            title: `${item?.title ?? ''}`.trim(),
            description: `${item?.description ?? ''}`.trim(),
            required: item?.required !== false
          }))
          .filter(item => item.id || item.title || item.description)
        : [],
      pricing: PricingBuilder.normalizePricingConfig(card?.pricing, { context: 'asset' })
    };
  }

  static normalizeOwnership(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO | null | undefined): Pick<AppDTOs.AssetDTO, 'ownerUserId' | 'ownerName' | 'ownerAvatarUrl' | 'ownerReleasedAtIso' | 'menuActions'> {
    return {
      ownerUserId: `${card?.ownerUserId ?? ''}`.trim() || undefined,
      ownerName: `${card?.ownerName ?? ''}`.trim() || undefined,
      ownerAvatarUrl: `${card?.ownerAvatarUrl ?? ''}`.trim() || null,
      ownerReleasedAtIso: `${card?.ownerReleasedAtIso ?? ''}`.trim() || null,
      menuActions: Array.isArray(card?.menuActions)
        ? card.menuActions.map((action: string) => `${action ?? ''}`.trim()).filter((action: string) => action.length > 0)
        : []
    };
  }

  static normalizeHeading(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO | null | undefined): Pick<AppDTOs.AssetDTO, 'id' | 'type' | 'title' | 'subtitle' | 'category' | 'city' | 'capacityTotal' | 'quantity'> | null {
    const id = card?.id?.trim() ?? '';
    const type = card?.type;
    if (!id || !AppConstants.isAssetType(type)) return null;
    return {
      id,
      type,
      title: card?.title?.trim() ?? '',
      subtitle: card?.subtitle?.trim() ?? '',
      category: AssetDefaultsBuilder.normalizeCategory(type, card?.category),
      city: card?.city?.trim() ?? '',
      capacityTotal: AssetCardBuilder.capacityValue({ capacityTotal: card?.capacityTotal ?? 0 }),
      quantity: AssetCardBuilder.storedQuantityValue({
        type,
        quantity: card?.quantity,
        capacityTotal: card?.capacityTotal ?? 0
      })
    };
  }

  static cloneFallbackCards<T extends AssetResourceValue>(
    fallbackCardsByType?: Partial<Record<AppConstants.AssetType, T[]>>
  ): Partial<Record<AppConstants.AssetType, T[]>> {
    const next: Partial<Record<AppConstants.AssetType, T[]>> = {};
    for (const type of AppConstants.ASSET_TYPES) {
      const cards = fallbackCardsByType?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards.map(card => this.cloneResourceCard(card));
    }
    return next;
  }

  static resourceDetail(card: AssetResourceValue): AppDTOs.AssetDetailDTO {
    return {
      id: card.id,
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: card.category,
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: AssetCardBuilder.storedQuantityValue(card),
      details: ActivityResourceBuilder.assetDetailText(card),
      imageUrl: card.imageUrl,
      sourceLink: ActivityResourceBuilder.assetSourceLink(card),
      routes: ActivityResourceBuilder.normalizeAssetRoutes(card.type, card.routes),
      topics: [...(card.topics ?? [])],
      policiesEnabled: AssetCardBuilder.assetPoliciesEnabled(card),
      policies: (card.policies ?? []).map(policy => ({ ...policy })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : card.pricing,
      visibility: card.visibility,
      status: card.status,
      ownerUserId: card.ownerUserId,
      ownerName: card.ownerName,
      ownerAvatarUrl: card.ownerAvatarUrl ?? null,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      })),
      menuActions: card.menuActions ? [...card.menuActions] : undefined
    };
  }

  static cloneResourceCard<T extends AssetResourceValue>(card: T): T {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }))
    };
  }

  static normalizeBorrowWindow(
    window: AppDTOs.AssetBorrowWindowDTO | null | undefined
  ): AppDTOs.AssetBorrowWindowDTO | null {
    const eventId = `${window?.eventId ?? ''}`.trim();
    const subEventId = `${window?.subEventId ?? ''}`.trim();
    const startAtIso = `${window?.startAtIso ?? ''}`.trim();
    const endAtIso = `${window?.endAtIso ?? ''}`.trim();
    return eventId && subEventId && startAtIso && endAtIso
      ? { eventId, subEventId, startAtIso, endAtIso }
      : null;
  }

  static assetPolicyCount(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): number {
    if (!AssetCardBuilder.assetPoliciesEnabled(card)) {
      return 0;
    }
    if ('policyCount' in card && Number.isFinite(Number(card.policyCount))) {
      return Math.max(0, Math.trunc(Number(card.policyCount)));
    }
    return 'policies' in card ? (card.policies ?? []).length : 0;
  }

  static assetPriceLabel(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): string | undefined {
    if ('priceLabel' in card && card.priceLabel?.trim()) {
      return card.priceLabel.trim();
    }
    if (!('pricing' in card) || !card.pricing?.enabled) {
      return undefined;
    }
    const amount = Math.max(0, Number(card.pricing.basePrice) || 0);
    if (amount <= 0) {
      return 'Free borrow';
    }
    const currency = card.pricing.currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(0)}`;
    }
  }

  static assetLocationLabel(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO, type: AppConstants.AssetType): string {
    if ('locationLabel' in card && card.locationLabel?.trim()) {
      return card.locationLabel.trim();
    }
    if (type !== AppConstants.ASSET_TYPE_ACCOMMODATION || !('routes' in card)) {
      return card.city?.trim() ?? '';
    }
    return (card.routes ?? [])
      .map(route => `${route ?? ''}`.trim())
      .find(route => route.length > 0)
      ?? card.city.trim();
  }

  static buildEmptyAssetForm(type: AppConstants.AssetType): AssetCardFormValue {
    return {
      type,
      title: '',
      subtitle: '',
      category: AssetDefaultsBuilder.defaultCategory(type),
      city: '',
      capacityTotal: type === AppConstants.ASSET_TYPE_SUPPLIES ? 6 : 4,
      quantity: this.defaultQuantity(type),
      details: '',
      imageUrl: '',
      sourceLink: '',
      routes: this.normalizeAssetRoutes(type, []),
      topics: [],
      policiesEnabled: false,
      policies: [],
      pricing: PricingBuilder.createDefaultPricingConfig('asset')
    };
  }

  static buildAssetFormFromCard(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): AssetCardFormValue {
    const detailCard = this.asDetail(card);
    const imageUrl = this.normalizeAssetLink(card.imageUrl);
    const sourceLink = this.normalizeAssetLink(card.sourceLink ?? detailCard?.sourceLink);
    return {
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: AssetDefaultsBuilder.normalizeCategory(card.type, card.category),
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: card.quantity,
      details: detailCard?.details ?? ('description' in card ? card.description : ''),
      imageUrl,
      sourceLink,
      routes: this.normalizeAssetRoutes(card.type, detailCard?.routes),
      topics: [...(detailCard?.topics ?? [])],
      policiesEnabled: this.assetPoliciesEnabled(card),
      policies: (detailCard?.policies ?? []).map(item => ({ ...item })),
      pricing: PricingBuilder.clonePricingConfig(detailCard?.pricing ?? PricingBuilder.createDefaultPricingConfig('asset'))
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
    const sourceLink = this.normalizeAssetLink(assetForm.sourceLink);
    return {
      type: assetForm.type,
      title,
      subtitle: assetForm.subtitle.trim(),
      category: AssetDefaultsBuilder.normalizeCategory(assetForm.type, assetForm.category),
      city: assetForm.type === AppConstants.ASSET_TYPE_ACCOMMODATION ? accommodationLocation : city,
      capacityTotal: Math.max(1, Number(assetForm.capacityTotal) || (assetForm.type === AppConstants.ASSET_TYPE_SUPPLIES ? 6 : 4)),
      quantity: this.normalizeQuantity(assetForm.type, assetForm.quantity, assetForm.capacityTotal),
      details: assetForm.details.trim(),
      imageUrl,
      sourceLink,
      routes,
      topics: [...(assetForm.topics ?? [])],
      policiesEnabled: assetForm.policiesEnabled === true,
      policies: this.normalizePolicies(assetForm.policies),
      pricing: PricingBuilder.compactPricingConfig(
        assetForm.pricing ?? PricingBuilder.createDefaultPricingConfig('asset'),
        { context: 'asset', allowSlotFeatures: false }
      )
    };
  }

  static visibilityFromCard(card: Pick<AppDTOs.AssetDTO, 'visibility'>): AppConstants.EventVisibility {
    return card.visibility === 'Friends only'
      ? 'Friends only'
      : card.visibility === 'Invitation only'
        ? 'Invitation only'
        : 'Public';
  }

  static activeAssetTypeFromFilter(filter: AppConstants.AssetFilterType): AppConstants.AssetType {
    if (filter === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return AppConstants.ASSET_TYPE_ACCOMMODATION;
    }
    if (filter === AppConstants.ASSET_TYPE_SUPPLIES) {
      return AppConstants.ASSET_TYPE_SUPPLIES;
    }
    return AppConstants.ASSET_TYPE_TRANSPORT;
  }

  static cloneCard(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): AppDTOs.AssetDTO {
    return AssetDto.clone(card);
  }

  static cloneCards(cards: readonly (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO)[]): AppDTOs.AssetDTO[] {
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

  static restoredAssetStatus(_card: AppDTOs.AssetDTO): string {
    return 'A';
  }

  static normalizeAssetRoutes(type: AppConstants.AssetType, routes: string[] | undefined | null): string[] {
    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
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
    card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO,
    options: { fallbackImageUrl?: string | null } = {}
  ): AppDTOs.AssetDTO {
    const imageUrl = this.normalizeAssetLink(card.imageUrl, options.fallbackImageUrl);
    return {
      ...AssetDto.clone(card),
      imageUrl
    };
  }

  static normalizeAssetMediaCards(
    cards: readonly (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO)[],
    options: { fallbackImageUrl?: (card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) => string | null | undefined } = {}
  ): AppDTOs.AssetDTO[] {
    return cards.map(card => this.normalizeAssetMedia(card, {
      fallbackImageUrl: options.fallbackImageUrl?.(card) ?? ''
    }));
  }

  static capacityLabel(card: AppDTOs.AssetDTO): string {
    return `${this.capacityValue(card)}`;
  }

  static quantityLabel(card: AppDTOs.AssetDTO): string {
    return `${this.quantityValue(card)}`;
  }

  static capacityValue(card: Pick<AppDTOs.AssetDTO, 'capacityTotal'>): number {
    return Math.max(1, Math.trunc(Number(card.capacityTotal) || 0));
  }

  static quantityValue(card: Pick<AppDTOs.AssetDTO, 'type' | 'quantity' | 'capacityTotal'>): number {
    return this.normalizeQuantity(card.type, card.quantity, card.capacityTotal);
  }

  static storedQuantityValue(
    card: Pick<AppDTOs.AssetDTO, 'type' | 'capacityTotal'> & { quantity: unknown }
  ): number {
    const parsed = Math.trunc(Number(card.quantity));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return this.normalizeQuantity(card.type, card.quantity, card.capacityTotal);
  }

  static defaultQuantity(type: AppConstants.AssetType): number {
    return type === AppConstants.ASSET_TYPE_SUPPLIES ? 6 : 1;
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
    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
      return Math.max(1, Math.trunc(Number(capacityFallback) || 0));
    }
    return this.defaultQuantity(type);
  }

  static primaryLocation(card: AppDTOs.AssetDTO): string {
    return card.type === AppConstants.ASSET_TYPE_ACCOMMODATION
      ? (card.locationLabel?.trim() || card.city.trim())
      : '';
  }

  static canOpenMap(card: AppDTOs.AssetDTO): boolean {
    return card.type === AppConstants.ASSET_TYPE_ACCOMMODATION && this.primaryLocation(card).length > 0;
  }

  static assetPoliciesEnabled(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO | null | undefined): boolean {
    if (!card) {
      return false;
    }
    if ('policiesEnabled' in card && card.policiesEnabled !== undefined) {
      return card.policiesEnabled === true;
    }
    if ('policyCount' in card && Number.isFinite(Number(card.policyCount)) && Number(card.policyCount) > 0) {
      return true;
    }
    return 'policies' in card && (card.policies ?? []).length > 0;
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
    try {
      const url = new URL(normalized);
      return (url.protocol === 'https:' || url.protocol === 'http:')
        && (url.hostname === 'loremflickr.com' || url.hostname === 'www.loremflickr.com');
    } catch {
      return false;
    }
  }

  private static asDetail(card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO): AppDTOs.AssetDetailDTO | null {
    return 'details' in card && 'sourceLink' in card ? card : null;
  }
}
