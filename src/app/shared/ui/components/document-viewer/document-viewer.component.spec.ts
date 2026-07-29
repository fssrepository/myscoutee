import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { HelpCenterService } from '../../../core';
import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import {
  DEFAULT_DEPLOYMENT_BRANDING,
  type DeploymentPrivacyContactDto
} from '../../../core/contracts/deployment-configuration.interface';
import { DocumentViewerComponent } from './document-viewer.component';
import type { DocumentViewerConfig } from './document-viewer.types';

describe('DocumentViewerComponent deployment privacy tokens', () => {
  const privacyContact = signal<DeploymentPrivacyContactDto>(
    unconfiguredPrivacyContact()
  );
  const i18nRevision = signal(0);
  const translations: Readonly<Record<string, string>> = {
    'deployment.privacy.data.controller': 'Data controller',
    'deployment.privacy.contact.email': 'Privacy contact',
    'deployment.privacy.contact.not.published':
      'No privacy contact has been published.',
    'deployment.privacy.deletion.email.prefix':
      'You can also send a deletion request to',
    'deployment.privacy.deletion.email.suffix': '.'
  };

  beforeEach(() => {
    privacyContact.set(unconfiguredPrivacyContact());
    i18nRevision.set(0);
    TestBed.configureTestingModule({
      imports: [DocumentViewerComponent],
      providers: [
        {
          provide: DeploymentConfigurationService,
          useValue: {
            branding: signal(DEFAULT_DEPLOYMENT_BRANDING).asReadonly(),
            privacyContact: privacyContact.asReadonly()
          }
        },
        {
          provide: I18nService,
          useValue: {
            revision: i18nRevision.asReadonly(),
            translate: (key: string) => translations[key] ?? key
          }
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: {} } }
        },
        {
          provide: HelpCenterService,
          useValue: {}
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('escapes and renders a configured contact without creating injected HTML', () => {
    privacyContact.set({
      configured: true,
      dataControllerName: '<Demo & Company>',
      privacyContactEmail: 'PRIVACY@EXAMPLE.TEST'
    });
    const fixture = createViewer(
      '{{deployment.privacy.contactDetails}}'
        + '{{deployment.privacy.deletionEmailRoute}}'
    );

    const rendered = privacyHtml(fixture.nativeElement);
    const emailLinks = rendered.querySelectorAll<HTMLAnchorElement>(
      'a[href="mailto:privacy@example.test"]'
    );

    expect(rendered.innerHTML).toContain(
      '&lt;Demo &amp; Company&gt;'
    );
    expect(rendered.textContent).toContain('<Demo & Company>');
    expect(rendered.querySelector('demo')).toBeNull();
    expect(emailLinks).toHaveLength(2);
  });

  it('renders the localized unconfigured message without a mailto link', () => {
    const fixture = createViewer(
      '{{deployment.privacy.contactDetails}}'
        + '{{deployment.privacy.deletionEmailRoute}}'
    );

    const rendered = privacyHtml(fixture.nativeElement);

    expect(rendered.textContent?.trim())
      .toBe('No privacy contact has been published.');
    expect(rendered.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('removes unknown deployment tokens before rendering', () => {
    const fixture = createViewer(
      'Before {{deployment.privacy.unknown}} after'
    );

    const rendered = privacyHtml(fixture.nativeElement);

    expect(rendered.textContent).toBe('Before  after');
    expect(rendered.innerHTML).not.toContain('{{');
  });

  function createViewer(contentHtml: string) {
    const fixture = TestBed.createComponent(DocumentViewerComponent);
    fixture.componentRef.setInput('config', viewerConfig(contentHtml));
    fixture.detectChanges();
    return fixture;
  }

  function viewerConfig(contentHtml: string): DocumentViewerConfig {
    return {
      shell: 'page',
      open: true,
      showBrand: false,
      title: 'Privacy',
      sections: [{
        id: 'contact-details',
        title: 'Contact details',
        contentHtml
      }]
    };
  }

  function privacyHtml(host: HTMLElement): HTMLElement {
    const rendered = host.querySelector<HTMLElement>(
      '.document-viewer-html'
    );
    expect(rendered).not.toBeNull();
    return rendered!;
  }
});

function unconfiguredPrivacyContact(): DeploymentPrivacyContactDto {
  return {
    configured: false,
    dataControllerName: '',
    privacyContactEmail: ''
  };
}
