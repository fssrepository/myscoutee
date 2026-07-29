import type {
  DeploymentPrivacyContactDto
} from '../contracts/deployment-configuration.interface';

export interface DeploymentPrivacyTokenText {
  dataControllerLabel: string;
  privacyContactEmailLabel: string;
  contactNotPublished: string;
  deletionEmailPrefix: string;
  deletionEmailSuffix: string;
}

const DEPLOYMENT_PRIVACY_TOKEN_PATTERN = /{{\s*([^{}]+?)\s*}}/g;
const PRIVACY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveDeploymentPrivacyTokens(
  source: string | null | undefined,
  contact: DeploymentPrivacyContactDto | null | undefined,
  text: DeploymentPrivacyTokenText
): string {
  const normalizedContact = configuredPrivacyContact(contact);
  return `${source ?? ''}`.replace(
    DEPLOYMENT_PRIVACY_TOKEN_PATTERN,
    (_match, token: string) => {
      switch (token.trim()) {
        case 'deployment.privacy.contactDetails':
          return normalizedContact
            ? contactDetailsHtml(normalizedContact, text)
            : `<p>${escapeHtml(text.contactNotPublished)}</p>`;
        case 'deployment.privacy.deletionEmailRoute':
          return normalizedContact
            ? deletionEmailRouteHtml(normalizedContact, text)
            : '';
        default:
          return '';
      }
    }
  );
}

function configuredPrivacyContact(
  contact: DeploymentPrivacyContactDto | null | undefined
): DeploymentPrivacyContactDto | null {
  const dataControllerName =
    `${contact?.dataControllerName ?? ''}`.trim();
  const privacyContactEmail =
    `${contact?.privacyContactEmail ?? ''}`.trim().toLowerCase();
  if (
    contact?.configured !== true
    || !dataControllerName
    || !PRIVACY_EMAIL_PATTERN.test(privacyContactEmail)
  ) {
    return null;
  }
  return {
    configured: true,
    dataControllerName,
    privacyContactEmail
  };
}

function contactDetailsHtml(
  contact: DeploymentPrivacyContactDto,
  text: DeploymentPrivacyTokenText
): string {
  const email = escapeHtml(contact.privacyContactEmail);
  return [
    '<ul>',
    '<li>',
    `<strong>${escapeHtml(text.dataControllerLabel)}:</strong> `,
    escapeHtml(contact.dataControllerName),
    '</li>',
    '<li>',
    `<strong>${escapeHtml(text.privacyContactEmailLabel)}:</strong> `,
    `<a href="mailto:${email}">${email}</a>`,
    '</li>',
    '</ul>'
  ].join('');
}

function deletionEmailRouteHtml(
  contact: DeploymentPrivacyContactDto,
  text: DeploymentPrivacyTokenText
): string {
  const email = escapeHtml(contact.privacyContactEmail);
  return [
    '<p>',
    escapeHtml(text.deletionEmailPrefix),
    ' ',
    `<a href="mailto:${email}">${email}</a>`,
    escapeHtml(text.deletionEmailSuffix),
    '</p>'
  ].join('');
}

function escapeHtml(value: string): string {
  return `${value ?? ''}`.replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] ?? ''
  );
}
