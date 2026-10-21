import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { HelpCenterService } from '../../../core';
import { DeploymentConfigurationService } from '../../../core/base/services/platform/deployment-configuration.service';
import { I18nService } from '../../../core/base/services/localization/i18n.service';
import {
  DEFAULT_DEPLOYMENT_BRANDING,
  type DeploymentPrivacyContactDto
} from '../../../core/contracts/platform/deployment-configuration.interface';
import { DocumentViewerComponent } from './document-viewer.component';
import type { DocumentViewerConfig } from './document-viewer.types';
import enBundle from '../../../../../assets/i18n/en.json';

describe('DocumentViewerComponent deployment privacy tokens', () => {
  const branding = signal({ ...DEFAULT_DEPLOYMENT_BRANDING });
  const privacyContact = signal<DeploymentPrivacyContactDto>(
    unconfiguredPrivacyContact()
  );
  const i18nRevision = signal(0);
  const translations: Readonly<Record<string, string>> = {
    ...enBundle.messages,
    'deployment.privacy.data.controller': 'Data controller',
    'deployment.privacy.contact.email': 'Privacy contact',
    'deployment.privacy.contact.not.published':
      'No privacy contact has been published.',
    'deployment.privacy.deletion.email.prefix':
      'You can also send a deletion request to',
    'deployment.privacy.deletion.email.suffix': '.',
    'document.terms.description':
      'Review the terms that apply when you use {productName}.'
  };

  beforeEach(() => {
    branding.set({ ...DEFAULT_DEPLOYMENT_BRANDING });
    privacyContact.set(unconfiguredPrivacyContact());
    i18nRevision.set(0);
    TestBed.configureTestingModule({
      imports: [DocumentViewerComponent],
      providers: [
        {
          provide: DeploymentConfigurationService,
          useValue: {
            branding: branding.asReadonly(),
            privacyContact: privacyContact.asReadonly()
          }
        },
        {
          provide: I18nService,
          useValue: {
            revision: i18nRevision.asReadonly(),
            translate: (key: string) => translations[key] ?? key,
            translateParams: (
              key: string,
              values: Readonly<Record<string, string | number>>
            ) => interpolate(translations[key] ?? key, values)
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

  it('renders the loaded route document without another user interaction', async () => {
    let complete!: () => void;
    const preload = new Promise<void>(resolve => { complete = resolve; });
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { documentKind: 'privacy' } } } });
    TestBed.overrideProvider(HelpCenterService, { useValue: {
      preload: () => preload,
      activePrivacyRevision: () => ({ summary: 'Loaded privacy', description: 'Loaded content', version: 2, sections: [] })
    } });
    const fixture = TestBed.createComponent(DocumentViewerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading privacy content');
    complete();
    await preload;
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Loaded privacy');
    expect(fixture.nativeElement.textContent).not.toContain('Loading privacy content');
  });

  it('renders the unavailable state when a route document fails to load', async () => {
    let fail!: (error: Error) => void;
    const preload = new Promise<void>((_resolve, reject) => { fail = reject; });
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { documentKind: 'privacy' } } } });
    TestBed.overrideProvider(HelpCenterService, { useValue: { preload: () => preload } });
    const fixture = TestBed.createComponent(DocumentViewerComponent);
    fixture.detectChanges();
    fail(new Error('Unavailable'));
    await preload.catch(() => undefined);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.document-viewer-status-loading')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Privacy is not available');
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

  it('interpolates deployment branding in an i18n-backed description', () => {
    branding.set({
      ...DEFAULT_DEPLOYMENT_BRANDING,
      productName: 'Community Hub',
      revision: 3
    });
    const fixture = TestBed.createComponent(DocumentViewerComponent);
    fixture.componentRef.setInput('config', {
      ...viewerConfig('<p>Terms</p>'),
      title: 'Usage terms',
      description: 'document.terms.description'
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.document-viewer-title-wrap p')
        ?.textContent
        ?.trim()
    ).toBe('Review the terms that apply when you use Community Hub.');
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

function interpolate(
  value: string,
  values: Readonly<Record<string, string | number>>
): string {
  return Object.entries(values).reduce(
    (result, [key, item]) => result.replaceAll(`{${key}}`, `${item}`),
    value
  );
}
