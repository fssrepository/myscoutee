import { OperatorConfigurationMapper } from './operator-configuration.mapper';

describe('OperatorConfigurationMapper', () => {
  it('normalizes and de-duplicates dedicated administrator emails', () => {
    expect(OperatorConfigurationMapper.adminEmails(
      ' Admin@Example.test, second@example.test\nadmin@example.test '
    )).toEqual([
      'admin@example.test',
      'second@example.test'
    ]);
  });

  it('allows an empty authorization list and rejects malformed addresses', () => {
    expect(OperatorConfigurationMapper.adminEmailValidationKey('')).toBeNull();
    expect(
      OperatorConfigurationMapper.adminEmailValidationKey('not-an-email')
    ).toBe('operator.configuration.admin.email.invalid');
  });

  it('limits the authorization list to 32 distinct addresses', () => {
    const emails = Array.from(
      { length: 33 },
      (_, index) => `admin-${index}@example.test`
    );
    expect(
      OperatorConfigurationMapper.adminEmailValidationKey(emails)
    ).toBe('operator.configuration.admin.email.too.many');
  });

  it('normalizes a configured privacy contact', () => {
    expect(OperatorConfigurationMapper.privacyContact({
      configured: true,
      dataControllerName: '  Example Operator s.r.o.  ',
      privacyContactEmail: ' Privacy@Example.test '
    })).toEqual({
      configured: true,
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: 'privacy@example.test'
    });
  });

  it('allows a blank privacy contact and rejects partial or invalid values', () => {
    expect(OperatorConfigurationMapper.privacyContactValidationKey({
      dataControllerName: '',
      privacyContactEmail: ''
    })).toBeNull();
    expect(OperatorConfigurationMapper.privacyContactValidationKey({
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: ''
    })).toBe('operator.configuration.privacy.contact.incomplete');
    expect(OperatorConfigurationMapper.privacyContactValidationKey({
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: 'not-an-email'
    })).toBe('operator.configuration.privacy.email.invalid');
    expect(OperatorConfigurationMapper.privacyContactValidationKey({
      dataControllerName: 'Example\u0000Operator',
      privacyContactEmail: 'privacy@example.test'
    })).toBe('operator.configuration.privacy.controller.invalid');
  });

  it('normalizes valid HTTPS social links and collapses exact duplicates', () => {
    const link = {
      provider: ' Community ',
      label: ' Community forum ',
      url: 'https://community.example.test',
      icon: ' forum ',
      handle: ' @community '
    };

    expect(OperatorConfigurationMapper.socialLinks([link, link])).toEqual([{
      provider: 'community',
      label: 'Community forum',
      url: 'https://community.example.test/',
      icon: 'forum',
      handle: '@community'
    }]);
    expect(
      OperatorConfigurationMapper.socialLinksValidationKey([link, link])
    ).toBeNull();
  });

  it('rejects unsafe and conflicting social links', () => {
    expect(OperatorConfigurationMapper.socialLinksValidationKey([{
      provider: 'community',
      label: 'Community',
      url: 'http://community.example.test',
      icon: null,
      handle: null
    }])).toBe('operator.configuration.social.link.invalid');

    expect(OperatorConfigurationMapper.socialLinksValidationKey([
      {
        provider: 'community',
        label: 'Community',
        url: 'https://community.example.test/',
        icon: null,
        handle: null
      },
      {
        provider: 'community',
        label: 'Other community',
        url: 'https://other.example.test/',
        icon: null,
        handle: null
      }
    ])).toBe('operator.configuration.social.provider.duplicate');
  });
});
