import { APP_STATIC_DATA } from '../../../app-static-data';
import type * as AppTypes from '../models';

export class AssetDefaultsBuilder {
  static assetTypeLabel(type: AppTypes.AssetFilterType): string {
    return APP_STATIC_DATA.assetTypeLabels[type];
  }

  static assetTypeIcon(type: AppTypes.AssetFilterType): string {
    if (type === 'Car') {
      return 'directions_car';
    }
    if (type === 'Accommodation') {
      return 'apartment';
    }
    if (type === 'Ticket') {
      return 'qr_code_2';
    }
    return 'inventory_2';
  }

  static assetTypeClass(type: AppTypes.AssetFilterType): string {
    if (type === 'Car') {
      return 'asset-filter-car';
    }
    if (type === 'Accommodation') {
      return 'asset-filter-accommodation';
    }
    if (type === 'Supplies') {
      return 'asset-filter-supplies';
    }
    if (type === 'Ticket') {
      return 'asset-filter-ticket';
    }
    return 'asset-filter-car';
  }

  static eventVisibilityClass(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'event-visibility-public';
      case 'Friends only':
        return 'event-visibility-friends';
      default:
        return 'event-visibility-invitation';
    }
  }

  static visibilityIcon(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Friends only':
        return 'groups';
      case 'Invitation only':
        return 'mail_lock';
      default:
        return 'public';
    }
  }

  static assetCategoryOptions(type: AppTypes.AssetType): AppTypes.AssetCategory[] {
    return [...(APP_STATIC_DATA.assetCategoryOptionsByType[type] ?? [])];
  }

  static assetCategoryLabel(category: AppTypes.AssetCategory | null | undefined): string {
    return `${category ?? ''}`.trim();
  }

  static assetCategoryIcon(
    category: AppTypes.AssetCategory | null | undefined,
    fallbackType: AppTypes.AssetType = this.assetCategoryType(category)
  ): string {
    switch (`${category ?? ''}`.trim().toLowerCase()) {
      case 'ride':
        return this.assetTypeIcon('Car');
      case 'stay':
        return this.assetTypeIcon('Accommodation');
      case 'camping':
        return 'forest';
      case 'cooking':
        return 'restaurant';
      case 'games':
        return 'sports_esports';
      case 'audio':
        return 'speaker';
      case 'sports':
        return 'sports_basketball';
      case 'safety':
        return 'health_and_safety';
      case 'decor':
        return 'celebration';
      case 'tech':
        return 'memory';
      default:
        return this.assetTypeIcon(fallbackType);
    }
  }

  static assetCategoryClass(
    category: AppTypes.AssetCategory | null | undefined,
    fallbackType: AppTypes.AssetType = this.assetCategoryType(category)
  ): string {
    switch (`${category ?? ''}`.trim().toLowerCase()) {
      case 'ride':
        return this.assetTypeClass('Car');
      case 'stay':
        return this.assetTypeClass('Accommodation');
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

  static assetCategoryType(category: AppTypes.AssetCategory | null | undefined): AppTypes.AssetType {
    switch (`${category ?? ''}`.trim().toLowerCase()) {
      case 'ride':
        return 'Car';
      case 'stay':
        return 'Accommodation';
      default:
        return 'Supplies';
    }
  }

  static defaultCategory(type: AppTypes.AssetType): AppTypes.AssetCategory {
    return this.assetCategoryOptions(type)[0] ?? '';
  }

  static normalizeCategory(type: AppTypes.AssetType, value: unknown): AppTypes.AssetCategory {
    const normalized = `${value ?? ''}`.trim();
    const options = this.assetCategoryOptions(type);
    if (options.some(option => option === normalized)) {
      return normalized;
    }
    return this.defaultCategory(type);
  }

  static ownedAssetEmptyLabel(type: AppTypes.AssetType): string {
    if (type === 'Accommodation') {
      return 'No properties yet';
    }
    if (type === 'Supplies') {
      return 'No supplies yet';
    }
    return 'No cars yet';
  }

  static ownedAssetEmptyDescription(type: AppTypes.AssetType): string {
    if (type === 'Accommodation') {
      return 'Add a property, stay, room, or place so it can show up here.';
    }
    if (type === 'Supplies') {
      return 'Add supplies or shared gear so the list can populate.';
    }
    return 'Add a car or ride so it can show up here.';
  }
}
