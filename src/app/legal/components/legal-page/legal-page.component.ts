import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { GDPR_CONTENT } from '../../../shared/gdpr-data';

type LegalPageKind = 'privacy' | 'deletion';

interface LegalSection {
  title: string;
  items: string[];
}

interface LegalPageContent {
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: LegalSection[];
}

@Component({
  selector: 'app-legal-page',
  standalone: true,
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss'
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly supportEmail = GDPR_CONTENT.contacts.find(contact => contact.label === 'Support Email')?.value ?? 'myscoutee1@gmail.com';

  protected readonly content = computed<LegalPageContent>(() => this.resolveContent(this.resolveKind()));

  private resolveKind(): LegalPageKind {
    const value = `${this.route.snapshot.data['legalPage'] ?? ''}`.trim();
    if (value === 'deletion') {
      return 'deletion';
    }
    return 'privacy';
  }

  private resolveContent(kind: LegalPageKind): LegalPageContent {
    if (kind === 'deletion') {
      return this.deletionContent();
    }
    return this.privacyContent();
  }

  private privacyContent(): LegalPageContent {
    return {
      eyebrow: 'MyScoutee privacy',
      title: 'Privacy Policy',
      summary: GDPR_CONTENT.subtitle,
      updatedAt: GDPR_CONTENT.updatedAt,
      sections: [
        {
          title: 'Contact',
          items: GDPR_CONTENT.contacts.map(contact => `${contact.label}: ${contact.value}`)
        },
        {
          title: 'Legal basis',
          items: GDPR_CONTENT.legalBases
        },
        {
          title: 'Data categories',
          items: GDPR_CONTENT.dataCategories.flatMap(section => section.items.map(item => `${section.category}: ${item}`))
        },
        {
          title: 'Purposes',
          items: GDPR_CONTENT.purposes
        },
        {
          title: 'Retention',
          items: GDPR_CONTENT.retention
        },
        {
          title: 'Sharing',
          items: GDPR_CONTENT.sharing
        },
        {
          title: 'Security',
          items: GDPR_CONTENT.security
        },
        {
          title: 'Your rights',
          items: GDPR_CONTENT.rights.flatMap(section => section.items.map(item => `${section.title}: ${item}`))
        }
      ]
    };
  }

  private deletionContent(): LegalPageContent {
    const confirmationCode = `${this.route.snapshot.queryParamMap.get('code') ?? ''}`.trim();
    const statusSection: LegalSection[] = confirmationCode
      ? [{
          title: 'Deletion request status',
          items: [
            `Confirmation code: ${confirmationCode}`,
            'The deletion request has been received. If it matches an existing MyScoutee account, that account is scheduled for deletion.',
            'The account can be reactivated within 30 days. After that window, eligible account data is permanently purged or anonymized.'
          ]
        }]
      : [];
    return {
      eyebrow: 'MyScoutee account controls',
      title: 'User Data Deletion',
      summary: 'How to request deletion of a MyScoutee account and related personal data.',
      updatedAt: GDPR_CONTENT.updatedAt,
      sections: [
        ...statusSection,
        {
          title: 'Meta/Facebook callback',
          items: [
            'For Meta app setup, use the Data Deletion Callback URL option.',
            'The callback validates Meta signed requests and schedules matching Facebook-login accounts through the same 30-day deletion flow used by the in-app Delete account button.'
          ]
        },
        {
          title: 'Delete from inside the app',
          items: [
            'Log in to MyScoutee.',
            'Open the user settings menu.',
            'Choose Delete account and confirm the deletion dialog.'
          ]
        },
        {
          title: 'Request deletion by email',
          items: [
            `Send a deletion request to ${this.supportEmail} from the email address connected to your MyScoutee account.`,
            'Include the account email and any provider used for login, such as Google, Facebook, or email/password.'
          ]
        },
        {
          title: 'Deletion window',
          items: [
            'Deleted accounts are scheduled for removal and can be reactivated for 30 days.',
            'After the reactivation window, account data is permanently purged or anonymized where required by product and legal retention rules.'
          ]
        }
      ]
    };
  }

}
