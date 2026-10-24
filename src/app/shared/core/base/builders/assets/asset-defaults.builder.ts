import { ASSET_TYPE_LABELS, ASSET_DEFAULT_CATEGORY_OPTIONS_BY_TYPE } from '../../../common/constants';

import * as AppConstants from '../../../common/constants';
export class AssetDefaultsBuilder {
  private static readonly transportCategories: readonly string[] = AppConstants.TRANSPORT_ASSET_CATEGORIES;
  private static readonly accommodationCategories: readonly string[] = AppConstants.ACCOMMODATION_ASSET_CATEGORIES;
  private static readonly suppliesCategories: readonly string[] = AppConstants.SUPPLIES_ASSET_CATEGORIES;

  static assetTypeLabel(type: AppConstants.AssetFilterType): string {
    return ASSET_TYPE_LABELS[type];
  }

  static assetTypeIcon(type: AppConstants.AssetFilterType): string {
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return 'directions_car';
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return 'apartment';
    }
    if (type === AppConstants.ASSET_FILTER_TICKET) {
      return 'qr_code_2';
    }
    return 'inventory_2';
  }

  static assetTypeClass(type: AppConstants.AssetFilterType): string {
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return 'asset-filter-transport';
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return 'asset-filter-accommodation';
    }
    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
      return 'asset-filter-supplies';
    }
    if (type === AppConstants.ASSET_FILTER_TICKET) {
      return 'asset-filter-ticket';
    }
    return 'asset-filter-transport';
  }

  static eventVisibilityClass(option: AppConstants.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'event-visibility-public';
      case 'Friends only':
        return 'event-visibility-friends';
      default:
        return 'event-visibility-invitation';
    }
  }

  static visibilityIcon(option: AppConstants.EventVisibility): string {
    switch (option) {
      case 'Friends only':
        return 'groups';
      case 'Invitation only':
        return 'mail_lock';
      default:
        return 'public';
    }
  }

  static assetCategoryOptions(type: AppConstants.AssetType): AppConstants.AssetCategory[] {
    return [...(ASSET_DEFAULT_CATEGORY_OPTIONS_BY_TYPE[type] ?? [])];
  }

  static assetCategoryLabel(category: AppConstants.AssetCategory | null | undefined): string {
    return `${category ?? ''}`.trim();
  }

  static assetCategoryIcon(
    category: AppConstants.AssetCategory | null | undefined,
    fallbackType: AppConstants.AssetType = this.assetCategoryType(category)
  ): string {
    const labels: Record<string, string> = {
      sedan: 'directions_car',
      suv: 'directions_car',
      van: 'airport_shuttle',
      shuttle: 'airport_shuttle',
      bus: 'directions_bus',
      truck: 'local_shipping',
      motorcycle: 'two_wheeler',
      bicycle: 'pedal_bike',
      boat: 'directions_boat',
      flight: 'flight',
      hotel: 'hotel',
      apartment: 'apartment',
      house: 'home',
      room: 'meeting_room',
      venue: 'stadium',
      campsite: 'cabin',
      storage: 'warehouse',
      workspace: 'business_center',
      camping: 'forest',
      cooking: 'restaurant',
      games: 'sports_esports',
      audio: 'speaker',
      sports: 'sports_basketball',
      safety: 'health_and_safety',
      decor: 'celebration',
      tech: 'memory'
    };
    return labels[`${category ?? ''}`.trim().toLowerCase()] ?? this.assetTypeIcon(fallbackType);
  }

  static assetCategoryClass(
    category: AppConstants.AssetCategory | null | undefined,
    fallbackType: AppConstants.AssetType = this.assetCategoryType(category)
  ): string {
    switch (`${category ?? ''}`.trim().toLowerCase()) {
      case 'camping':
        return 'asset-category-camping';
      case 'cooking':
        return 'asset-category-cooking';
      case 'games':
        return 'asset-category-games';
      case 'audio':
        return 'asset-category-audio';
      case 'sports':
        return 'asset-category-sports';
      case 'safety':
        return 'asset-category-safety';
      case 'decor':
        return 'asset-category-decor';
      case 'tech':
        return 'asset-category-tech';
      default:
        return this.assetTypeClass(fallbackType);
    }
  }

  static assetCategoryType(category: AppConstants.AssetCategory | null | undefined): AppConstants.AssetType {
    const normalized = this.normalizedCategory(category);
    if (this.includesCategory(this.transportCategories, normalized)) {
      return AppConstants.ASSET_TYPE_TRANSPORT;
    }
    if (this.includesCategory(this.accommodationCategories, normalized)) {
      return AppConstants.ASSET_TYPE_ACCOMMODATION;
    }
    if (this.includesCategory(this.suppliesCategories, normalized)) {
      return AppConstants.ASSET_TYPE_SUPPLIES;
    }
    return AppConstants.ASSET_TYPE_SUPPLIES;
  }

  static defaultCategory(type: AppConstants.AssetType): AppConstants.AssetCategory {
    return this.assetCategoryOptions(type)[0] ?? '';
  }

  static normalizeCategory(type: AppConstants.AssetType, value: unknown): AppConstants.AssetCategory {
    const normalized = `${value ?? ''}`.trim();
    const options = this.assetCategoryOptions(type);
    if (options.some(option => option === normalized)) {
      return normalized;
    }
    return this.defaultCategory(type);
  }

  private static normalizedCategory(category: AppConstants.AssetCategory | null | undefined): string {
    return `${category ?? ''}`.trim().toLowerCase();
  }

  private static includesCategory(options: readonly string[], normalizedCategory: string): boolean {
    return options.some(option => option.toLowerCase() === normalizedCategory);
  }
}
