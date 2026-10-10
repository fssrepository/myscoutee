import { UiDateUtils, clampNumber } from '@myscoutee/components';

import type { ActivitiesView } from '../contracts';
import type { AssetMemberRequestDTO } from '../contracts';
import type { UserDto } from '../contracts/user.interface';

interface ActivityGroupableModel {
  dateIso?: string | null;
  distanceMetersExact?: number | null;
}

export interface AsciiEmojiConversion {
  token: string;
  emoji: string;
  label: string;
}

const ASCII_EMOJI_CONVERSIONS: readonly AsciiEmojiConversion[] = [
  { token: ':)', emoji: '🙂', label: 'Smile' },
  { token: ':-)', emoji: '🙂', label: 'Smile' },
  { token: '=)', emoji: '🙂', label: 'Smile' },
  { token: ':D', emoji: '😄', label: 'Grin' },
  { token: ':-D', emoji: '😄', label: 'Grin' },
  { token: '=D', emoji: '😄', label: 'Grin' },
  { token: 'xD', emoji: '😆', label: 'Laugh' },
  { token: 'XD', emoji: '😆', label: 'Laugh' },
  { token: ';)', emoji: '😉', label: 'Wink' },
  { token: ';-)', emoji: '😉', label: 'Wink' },
  { token: ':(', emoji: '🙁', label: 'Sad' },
  { token: ':-(', emoji: '🙁', label: 'Sad' },
  { token: ":'(", emoji: '😢', label: 'Cry' },
  { token: ":'-(", emoji: '😢', label: 'Cry' },
  { token: ':P', emoji: '😛', label: 'Tongue' },
  { token: ':-P', emoji: '😛', label: 'Tongue' },
  { token: ':p', emoji: '😛', label: 'Tongue' },
  { token: ':-p', emoji: '😛', label: 'Tongue' },
  { token: ';P', emoji: '😜', label: 'Wink tongue' },
  { token: ';-P', emoji: '😜', label: 'Wink tongue' },
  { token: ':o', emoji: '😮', label: 'Surprise' },
  { token: ':O', emoji: '😮', label: 'Surprise' },
  { token: ':-o', emoji: '😮', label: 'Surprise' },
  { token: ':-O', emoji: '😮', label: 'Surprise' },
  { token: ':/', emoji: '🫤', label: 'Unsure' },
  { token: ':-/', emoji: '🫤', label: 'Unsure' },
  { token: ':\\', emoji: '🫤', label: 'Unsure' },
  { token: ':-\\', emoji: '🫤', label: 'Unsure' },
  { token: ':|', emoji: '😐', label: 'Neutral' },
  { token: ':-|', emoji: '😐', label: 'Neutral' },
  { token: ':*', emoji: '😘', label: 'Kiss' },
  { token: ':-*', emoji: '😘', label: 'Kiss' },
  { token: '<3', emoji: '❤️', label: 'Heart' },
  { token: '</3', emoji: '💔', label: 'Broken heart' },
  { token: 'B)', emoji: '😎', label: 'Cool' },
  { token: 'B-)', emoji: '😎', label: 'Cool' },
  { token: '8)', emoji: '😎', label: 'Cool' },
  { token: '8-)', emoji: '😎', label: 'Cool' },
  { token: 'O:)', emoji: '😇', label: 'Angel' },
  { token: 'O:-)', emoji: '😇', label: 'Angel' },
  { token: '0:)', emoji: '😇', label: 'Angel' },
  { token: '0:-)', emoji: '😇', label: 'Angel' },
  { token: '>:)', emoji: '😈', label: 'Devil' },
  { token: '>:-)', emoji: '😈', label: 'Devil' },
  { token: '-_-', emoji: '😑', label: 'Unamused' }
];

const ASCII_EMOJI_BY_TOKEN = new Map(
  ASCII_EMOJI_CONVERSIONS.map(conversion => [conversion.token, conversion])
);

const ASCII_EMOJI_TOKEN_REGEX = new RegExp(
  `(^|[\\s([{])(${ASCII_EMOJI_CONVERSIONS
    .map(conversion => conversion.token)
    .sort((first, second) => second.length - first.length)
    .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})(?=$|[\\s.,!?;:\\])}])`,
  'g'
);

export class AppUtils {
  static cloneMapItems<T extends object>(input: Record<string, T[]>): Record<string, T[]> {
    const output: Record<string, T[]> = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = value.map(item => ({ ...item }));
    }
    return output;
  }

  static normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  static findByAlias<T extends { aliases: readonly string[] }>(
    entries: readonly T[],
    value: string
  ): T | null {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }
    return entries.find(entry =>
      entry.aliases.some(alias => normalized.includes(this.normalizeText(alias)))
    ) ?? null;
  }

  static initialsFromText(value: string): string {
    const words = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) {
      return 'U';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }

  static hasText(value: unknown, minLength = 1): boolean {
    return `${value ?? ''}`.trim().length >= Math.max(0, Math.trunc(minLength));
  }

  static positiveInteger(value: unknown, fallback = 0): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  static normalizeRoutePath(url: string | null | undefined): string {
    const [pathWithQuery] = `${url ?? '/'}`.split('?');
    const [path] = (pathWithQuery || '').split('#');
    const normalized = path.trim();
    if (!normalized || normalized === '/') {
      return '/';
    }
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  static revokeObjectUrl(value: string | null | undefined): void {
    const normalized = `${value ?? ''}`.trim();
    if (normalized.startsWith('blob:')) {
      URL.revokeObjectURL(normalized);
    }
  }

  static hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }

  static firstImageUrl(images: readonly string[] | undefined | null): string {
    return (images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .find(image => image.length > 0) ?? '';
  }

  static asciiEmojiConversions(): readonly AsciiEmojiConversion[] {
    return ASCII_EMOJI_CONVERSIONS;
  }

  static convertAsciiEmojis(value: string | null | undefined): string {
    const text = `${value ?? ''}`;
    if (!text) {
      return '';
    }
    return text.replace(ASCII_EMOJI_TOKEN_REGEX, (_match, prefix: string, token: string) => {
      const conversion = ASCII_EMOJI_BY_TOKEN.get(token);
      return conversion ? `${prefix}${conversion.emoji}` : `${prefix}${token}`;
    });
  }

  static trailingAsciiEmojiToken(value: string | null | undefined): string {
    const match = `${value ?? ''}`.match(/(?:^|[\s([{])(\S{1,8})$/);
    const token = `${match?.[1] ?? ''}`.trim();
    return token && this.asciiEmojiSuggestionsForToken(token, 1).length > 0 ? token : '';
  }

  static asciiEmojiSuggestionsForToken(
    token: string | null | undefined,
    limit = 8
  ): readonly AsciiEmojiConversion[] {
    const normalized = `${token ?? ''}`.trim();
    if (!normalized) {
      return [];
    }
    const lower = normalized.toLowerCase();
    return ASCII_EMOJI_CONVERSIONS
      .filter(conversion => conversion.token.toLowerCase().startsWith(lower))
      .sort((first, second) => {
        const firstExact = first.token.toLowerCase() === lower ? 0 : 1;
        const secondExact = second.token.toLowerCase() === lower ? 0 : 1;
        return firstExact - secondExact || first.token.length - second.token.length;
      })
      .slice(0, Math.max(1, Math.trunc(limit)));
  }

  static replaceTrailingAsciiEmojiToken(
    value: string | null | undefined,
    replacement: string
  ): string {
    const text = `${value ?? ''}`;
    const token = this.trailingAsciiEmojiToken(text);
    if (!token) {
      return text;
    }
    return `${text.slice(0, text.length - token.length)}${replacement}`;
  }

  static mediaImageVariantUrl(
    imageUrl: string | null | undefined,
    variant: 'small' | 'medium' | 'large'
  ): string {
    const normalized = `${imageUrl ?? ''}`.trim();
    if (!normalized) {
      return '';
    }
    const publicKey = this.mediaPublicObjectKey(normalized);
    if (!publicKey) {
      return normalized;
    }
    const variantKey = this.mediaVariantObjectKey(publicKey, variant);
    if (!variantKey) {
      return normalized;
    }
    return normalized.replace(/([?&]key=)([^&#]*)/, (_match, prefix: string) =>
      `${prefix}${encodeURIComponent(variantKey)}`
    );
  }

  static mediaImageVariantHtml(
    html: string | null | undefined,
    variant: 'small' | 'medium' | 'large'
  ): string {
    const normalized = `${html ?? ''}`;
    if (!normalized || typeof document === 'undefined') {
      return normalized;
    }
    const template = document.createElement('template');
    template.innerHTML = normalized;
    template.content.querySelectorAll<HTMLImageElement>('img[src]').forEach(image => {
      const sourceUrl = image.getAttribute('src');
      const variantUrl = this.mediaImageVariantUrl(sourceUrl, variant);
      if (variantUrl) {
        image.setAttribute('src', variantUrl);
      }
    });
    return template.innerHTML;
  }

  static removeManagedImageReferencesHtml(
    html: string | null | undefined,
    imageUrls: Iterable<string | null | undefined> | null | undefined
  ): string {
    const normalized = `${html ?? ''}`;
    if (!normalized || typeof document === 'undefined') {
      return normalized;
    }
    const removedGroups = new Set(
      Array.from(imageUrls ?? [])
        .map(imageUrl => this.managedImageGroupKey(`${imageUrl ?? ''}`))
        .filter((groupKey): groupKey is string => Boolean(groupKey))
    );
    if (removedGroups.size === 0) {
      return normalized;
    }
    const template = document.createElement('template');
    template.innerHTML = normalized;
    template.content.querySelectorAll<HTMLElement>('img, a[href]').forEach(element => {
      const attribute = element.tagName.toLowerCase() === 'img' ? 'src' : 'href';
      const reference = element.getAttribute(attribute) ?? '';
      if (element.tagName.toLowerCase() === 'img' && !reference.trim()) {
        element.remove();
        return;
      }
      const groupKey = this.managedImageGroupKey(reference);
      if (groupKey && removedGroups.has(groupKey)) {
        element.remove();
      }
    });
    template.content.querySelectorAll<HTMLElement>('figure').forEach(figure => {
      if (!figure.textContent?.trim() && figure.children.length === 0) {
        figure.remove();
      }
    });
    return template.innerHTML;
  }

  static isHtmlTagPosition(html: string | null | undefined, offset: number): boolean {
    const source = `${html ?? ''}`;
    const normalizedOffset = Math.max(0, Math.min(source.length, Math.trunc(Number(offset)) || 0));
    return source.lastIndexOf('<', normalizedOffset - 1) > source.lastIndexOf('>', normalizedOffset - 1);
  }

  static looksLikeHtmlFragment(value: string | null | undefined): boolean {
    return /^<(?:!--|!doctype\b|\/?[a-z][a-z0-9:-]*(?:\s|>|\/))/i.test(`${value ?? ''}`.trim());
  }

  static uniqueTrimmedStrings(values: Iterable<string | null | undefined> | null | undefined): string[] {
    return Array.from(new Set(
      Array.from(values ?? [])
        .map(value => `${value ?? ''}`.trim())
        .filter(Boolean)
    ));
  }

  private static mediaPublicObjectKey(imageUrl: string): string | null {
    const match = imageUrl.match(/[?&]key=([^&#]+)/);
    if (!match?.[1]) {
      return null;
    }
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }

  private static managedImageGroupKey(imageUrl: string): string | null {
    const objectKey = this.mediaPublicObjectKey(imageUrl);
    if (!objectKey?.startsWith('images/')) {
      return null;
    }
    const slashIndex = objectKey.lastIndexOf('/');
    if (slashIndex <= 0 || slashIndex >= objectKey.length - 1) {
      return null;
    }
    const objectName = objectKey.slice(slashIndex + 1);
    return /^(?:original|small\.webp|medium\.webp|large\.webp)$/.test(objectName)
      ? objectKey.slice(0, slashIndex)
      : null;
  }

  private static mediaVariantObjectKey(
    objectKey: string,
    variant: 'small' | 'medium' | 'large'
  ): string | null {
    if (!/^(?:images\/|private\/images\/|public\/(?:demo|branding)\/images\/)/.test(objectKey)) {
      return null;
    }
    const slashIndex = objectKey.lastIndexOf('/');
    if (slashIndex <= 0 || slashIndex >= objectKey.length - 1) {
      return null;
    }
    const objectName = objectKey.slice(slashIndex + 1);
    if (!/^(?:small|medium|large)\.webp$/.test(objectName)) {
      return null;
    }
    return `${objectKey.slice(0, slashIndex)}/${variant}.webp`;
  }

  static enumValue<T extends string>(
    value: string | null | undefined,
    values: readonly T[],
    fallback: T
  ): T {
    return this.enumValueOrNull(value, values) ?? fallback;
  }

  static enumValueOrNull<T extends string>(
    value: string | null | undefined,
    values: readonly T[]
  ): T | null {
    const normalized = `${value ?? ''}`.trim();
    return (values as readonly string[]).includes(normalized) ? normalized as T : null;
  }

  static tournamentStageAccentHue(stageNumber: number, totalStages: number): number {
    const normalizedStageNumber = Math.max(1, Math.trunc(Number(stageNumber) || 1));
    const normalizedTotalStages = Math.max(normalizedStageNumber, Math.trunc(Number(totalStages) || 1));
    if (normalizedTotalStages <= 1) {
      return 210;
    }
    const ratio = clampNumber(
      (normalizedStageNumber - 1) / (normalizedTotalStages - 1),
      0,
      1
    );
    return Math.round(210 - (210 * ratio));
  }

  static activityGroupLabel(
    row: ActivityGroupableModel,
    activitiesView: ActivitiesView,
    labels: { dateUnavailable: string; weekPrefix: string }
  ): string {
    if (activitiesView === 'distance') {
      const distanceMeters = Number.isFinite(row.distanceMetersExact)
        ? Math.max(0, Math.trunc(Number(row.distanceMetersExact)))
        : 0;
      const bucket = Math.floor(distanceMeters / 5000) * 5;
      return `${bucket} km`;
    }
    const parsed = new Date(row.dateIso ?? '');
    if (Number.isNaN(parsed.getTime())) {
      return labels.dateUnavailable;
    }
    if (activitiesView === 'day') {
      return UiDateUtils.smartListDayLabel(parsed);
    }
    if (activitiesView === 'month') {
      return parsed.toLocaleDateString(UiDateUtils.browserLocale(), { month: 'long', year: 'numeric' });
    }
    return `${labels.weekPrefix} ${UiDateUtils.isoWeekNumber(parsed)}, ${parsed.getFullYear()}`;
  }

  static findUserByName(users: UserDto[], name: string): UserDto | undefined {
    const target = this.normalizeText(name);
    return users.find(user => this.normalizeText(user.name) === target);
  }

  static resolveAssetRequestUserId(request: AssetMemberRequestDTO, users: UserDto[]): string {
    if (request.userId) {
      return request.userId;
    }
    const matchedUser =
        users.find(user => user.name === request.name && user.initials === request.initials)
        ?? users.find(user => user.name === request.name)
        ?? null;
    return matchedUser?.id ?? request.id;
  }

  static withContextIconItems(summary: string, iconMap: Record<string, string>): string[] {
    return summary
      .split(',')
      .map(part => {
        const trimmed = part.trim();
        const key = Object.keys(iconMap).find(label => trimmed.startsWith(label));
        return key ? `${iconMap[key]} ${trimmed}` : trimmed;
      });
  }

  static badgeItemsLength(items: string[]): number {
    return items.reduce((sum, item) => sum + item.length, 0);
  }
}
