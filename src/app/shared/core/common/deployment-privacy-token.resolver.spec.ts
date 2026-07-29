import { describe, expect, it } from 'vitest';

import {
  resolveDeploymentPrivacyTokens,
  type DeploymentPrivacyTokenText
} from './deployment-privacy-token.resolver';

const text: DeploymentPrivacyTokenText = {
  dataControllerLabel: 'Data controller',
  privacyContactEmailLabel: 'Privacy contact',
  contactNotPublished: 'The operator did not publish a privacy contact.',
  deletionEmailPrefix: 'You can also send a deletion request to',
  deletionEmailSuffix: '.'
};

describe('resolveDeploymentPrivacyTokens', () => {
  it('escapes configured deployment values and renders no DPO line', () => {
    const resolved = resolveDeploymentPrivacyTokens(
      '{{deployment.privacy.contactDetails}}'
        + '{{deployment.privacy.deletionEmailRoute}}',
      {
        configured: true,
        dataControllerName: '<Demo & Company>',
        privacyContactEmail: 'PRIVACY@EXAMPLE.TEST'
      },
      text
    );

    expect(resolved).toContain('&lt;Demo &amp; Company&gt;');
    expect(resolved).toContain(
      'mailto:privacy@example.test'
    );
    expect(resolved).not.toContain('<Demo & Company>');
    expect(resolved).not.toContain('DPO');
  });

  it('shows the localized unconfigured state without an email deletion route', () => {
    const resolved = resolveDeploymentPrivacyTokens(
      '{{deployment.privacy.contactDetails}}'
        + '{{deployment.privacy.deletionEmailRoute}}',
      {
        configured: false,
        dataControllerName: '',
        privacyContactEmail: ''
      },
      text
    );

    expect(resolved).toBe(
      '<p>The operator did not publish a privacy contact.</p>'
    );
    expect(resolved).not.toContain('mailto:');
  });

  it('removes unknown tokens', () => {
    expect(resolveDeploymentPrivacyTokens(
      'before{{deployment.unknown}}after',
      null,
      text
    )).toBe('beforeafter');
  });
});
