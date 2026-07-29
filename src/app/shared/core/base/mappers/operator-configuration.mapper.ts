import type {
  DeploymentPrivacyContactDto,
  DeploymentSocialLinkDto
} from '../../contracts/deployment-configuration.interface';

export class OperatorConfigurationMapper {
  static readonly ADMIN_EMAIL_MAX_COUNT = 32;
  static readonly ADMIN_EMAIL_MAX_LENGTH = 254;
  static readonly SOCIAL_LINK_MAX_COUNT = 12;
  static readonly DATA_CONTROLLER_NAME_MAX_LENGTH = 160;
  static readonly PRIVACY_CONTACT_EMAIL_MAX_LENGTH = 254;
  static readonly PAYMENT_PUBLIC_BASE_URL_MAX_LENGTH = 2048;
  static readonly PAYMENT_MERCHANT_ACCOUNT_MAX_LENGTH = 254;

  static privacyContact(value: unknown): DeploymentPrivacyContactDto {
    const source = value && typeof value === 'object'
      ? value as Partial<DeploymentPrivacyContactDto>
      : {};
    const dataControllerName =
      `${source.dataControllerName ?? ''}`.trim();
    const privacyContactEmail =
      `${source.privacyContactEmail ?? ''}`.trim().toLowerCase();
    return {
      configured: Boolean(dataControllerName && privacyContactEmail),
      dataControllerName,
      privacyContactEmail
    };
  }

  static privacyContactValidationKey(value: unknown): string | null {
    const source = value && typeof value === 'object'
      ? value as Partial<DeploymentPrivacyContactDto>
      : {};
    const dataControllerName =
      `${source.dataControllerName ?? ''}`.trim();
    const privacyContactEmail =
      `${source.privacyContactEmail ?? ''}`.trim().toLowerCase();
    if (Boolean(dataControllerName) !== Boolean(privacyContactEmail)) {
      return 'operator.configuration.privacy.contact.incomplete';
    }
    if (!dataControllerName && !privacyContactEmail) {
      return null;
    }
    if (
      dataControllerName.length > this.DATA_CONTROLLER_NAME_MAX_LENGTH
      || /[\u0000-\u001f\u007f-\u009f]/.test(dataControllerName)
    ) {
      return 'operator.configuration.privacy.controller.invalid';
    }
    if (
      privacyContactEmail.length > this.PRIVACY_CONTACT_EMAIL_MAX_LENGTH
      || /[\u0000-\u001f\u007f-\u009f]/.test(privacyContactEmail)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacyContactEmail)
    ) {
      return 'operator.configuration.privacy.email.invalid';
    }
    return null;
  }

  static adminEmails(value: unknown): string[] {
    const source = Array.isArray(value)
      ? value.map(item => `${item ?? ''}`)
      : `${value ?? ''}`.split(/[,;\r\n]+/);
    const unique = new Set<string>();
    const normalized: string[] = [];
    for (const item of source) {
      const email = item.trim().toLowerCase();
      if (!email || unique.has(email)) {
        continue;
      }
      unique.add(email);
      normalized.push(email);
    }
    return normalized;
  }

  static adminEmailInput(value: unknown): string {
    return this.adminEmails(value).join(', ');
  }

  static adminEmailValidationKey(value: unknown): string | null {
    const emails = this.adminEmails(value);
    if (emails.length > this.ADMIN_EMAIL_MAX_COUNT) {
      return 'operator.configuration.admin.email.too.many';
    }
    return emails.some(email =>
      email.length > this.ADMIN_EMAIL_MAX_LENGTH
      || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)
    )
      ? 'operator.configuration.admin.email.invalid'
      : null;
  }

  static adminEmailsEqual(left: unknown, right: unknown): boolean {
    const normalizedLeft = this.adminEmails(left);
    const normalizedRight = this.adminEmails(right);
    return normalizedLeft.length === normalizedRight.length
      && normalizedLeft.every((email, index) => email === normalizedRight[index]);
  }

  static socialLinks(value: unknown): DeploymentSocialLinkDto[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const links: DeploymentSocialLinkDto[] = [];
    const signatures = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const source = item as Partial<DeploymentSocialLinkDto>;
      const provider = `${source.provider ?? ''}`.trim().toLowerCase().slice(0, 32);
      const label = `${source.label ?? ''}`.trim().slice(0, 80);
      const url = this.socialUrl(source.url);
      const icon = `${source.icon ?? ''}`.trim().slice(0, 64) || null;
      const handle = `${source.handle ?? ''}`.trim().slice(0, 80) || null;
      const signature = `${provider}\u0000${url.toLowerCase()}`;
      if (!provider || !label || !url || signatures.has(signature)) {
        continue;
      }
      signatures.add(signature);
      links.push({ provider, label, url, icon, handle });
      if (links.length >= this.SOCIAL_LINK_MAX_COUNT) {
        break;
      }
    }
    return links;
  }

  static socialLinksValidationKey(value: unknown): string | null {
    if (!Array.isArray(value)) {
      return 'operator.configuration.social.link.invalid';
    }
    if (value.length > this.SOCIAL_LINK_MAX_COUNT) {
      return 'operator.configuration.social.link.too.many';
    }
    const providers = new Map<string, string>();
    const urls = new Map<string, string>();
    const exactItems = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        return 'operator.configuration.social.link.invalid';
      }
      const source = item as Partial<DeploymentSocialLinkDto>;
      const provider = `${source.provider ?? ''}`.trim().toLowerCase();
      const label = `${source.label ?? ''}`.trim();
      const rawUrl = `${source.url ?? ''}`.trim();
      const icon = `${source.icon ?? ''}`.trim();
      const handle = `${source.handle ?? ''}`.trim();
      const url = this.socialUrl(rawUrl);
      if (
        !provider
        || provider.length > 32
        || !/^[a-z0-9][a-z0-9._-]*$/i.test(provider)
        || !label
        || label.length > 80
        || !url
        || rawUrl.length > 2048
        || icon.length > 64
        || handle.length > 80
      ) {
        return 'operator.configuration.social.link.invalid';
      }
      const canonicalUrl = url.toLowerCase();
      const exactItem = JSON.stringify({
        provider,
        label,
        url: canonicalUrl,
        icon,
        handle
      });
      if (exactItems.has(exactItem)) {
        continue;
      }
      exactItems.add(exactItem);
      const existingUrl = providers.get(provider);
      const existingProvider = urls.get(canonicalUrl);
      if (
        (existingUrl && existingUrl !== exactItem)
        || (existingProvider && existingProvider !== exactItem)
      ) {
        return 'operator.configuration.social.provider.duplicate';
      }
      providers.set(provider, exactItem);
      urls.set(canonicalUrl, exactItem);
    }
    return null;
  }

  static socialLinksEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(this.socialLinks(left))
      === JSON.stringify(this.socialLinks(right));
  }

  static paymentPublicBaseUrl(value: unknown): string {
    const normalized = `${value ?? ''}`.trim();
    if (
      !normalized
      || normalized.length > this.PAYMENT_PUBLIC_BASE_URL_MAX_LENGTH
    ) {
      return '';
    }
    try {
      const url = new URL(normalized);
      const loopbackHost = [
        'localhost',
        '127.0.0.1',
        '::1',
        '[::1]'
      ].includes(url.hostname.toLowerCase());
      if (
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopbackHost))
        || !url.hostname
        || url.username
        || url.password
        || url.search
        || url.hash
        || /(?:^|\/)\.\.(?:\/|$)/.test(url.pathname)
      ) {
        return '';
      }
      return url.toString().replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  static paymentMerchantAccount(value: unknown): string {
    return `${value ?? ''}`.trim();
  }

  static paymentValidationKey(value: unknown): string | null {
    const source = value && typeof value === 'object'
      ? value as {
          providerId?: unknown;
          publicBaseUrl?: unknown;
          merchantAccount?: unknown;
        }
      : {};
    const providerId = `${source.providerId ?? ''}`.trim().toLowerCase();
    if (!providerId) {
      return null;
    }
    const publicBaseUrl = `${source.publicBaseUrl ?? ''}`.trim();
    if (!publicBaseUrl) {
      return 'operator.configuration.payment.public.url.required';
    }
    if (!this.paymentPublicBaseUrl(publicBaseUrl)) {
      return 'operator.configuration.payment.public.url.invalid';
    }
    if (providerId !== 'barion') {
      return null;
    }
    const merchantAccount = this.paymentMerchantAccount(
      source.merchantAccount
    );
    if (!merchantAccount) {
      return 'operator.configuration.payment.merchant.account.required';
    }
    return (
      merchantAccount.length > this.PAYMENT_MERCHANT_ACCOUNT_MAX_LENGTH
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merchantAccount)
    )
      ? 'operator.configuration.payment.merchant.account.invalid'
      : null;
  }

  private static socialUrl(value: unknown): string {
    const normalized = `${value ?? ''}`.trim();
    try {
      const url = new URL(normalized);
      return (
        url.protocol === 'https:'
        && !url.username
        && !url.password
        && Boolean(url.hostname)
      )
        ? url.toString()
        : '';
    } catch {
      return '';
    }
  }
}
