export interface GdprContact {
  label: string;
  value: string;
}

export interface GdprListSection {
  title: string;
  items: string[];
}

export interface GdprDataCategory {
  category: string;
  items: string[];
}

export interface GdprContent {
  title: string;
  subtitle: string;
  updatedAt: string;
  contacts: GdprContact[];
  legalBases: string[];
  rights: GdprListSection[];
  dataCategories: GdprDataCategory[];
  purposes: string[];
  retention: string[];
  sharing: string[];
  security: string[];
}

export const GDPR_CONTENT: GdprContent = {
  title: 'Privacy',
  subtitle: 'How myscoutee handles personal data for profile, events, and social activity (including GDPR rights).',
  updatedAt: '2026-02-01',
  contacts: [
    { label: 'Data Controller', value: 'myscoutee demo platform' },
    { label: 'Support Email', value: 'privacy@myscoutee.app' },
    { label: 'DPO Contact', value: 'dpo@myscoutee.app' }
  ],
  legalBases: [
    'Contract performance for account and event features.',
    'Legitimate interest for platform safety and abuse prevention.',
    'Consent for optional profile details, precise location coordinates, and marketing communication.',
    'Legal obligation for security logs and compliance records.'
  ],
  rights: [
    {
      title: 'Access',
      items: ['Request a copy of your stored personal data.']
    },
    {
      title: 'Rectification',
      items: ['Correct inaccurate profile or account details.']
    },
    {
      title: 'Erasure',
      items: ['Request account and personal data deletion where legally possible.']
    },
    {
      title: 'Portability',
      items: ['Export your data in a commonly used machine-readable format.']
    },
    {
      title: 'Restriction / Objection',
      items: ['Limit or object to specific processing activities.']
    }
  ],
  dataCategories: [
    {
      category: 'Account & Identity',
      items: ['Name', 'Birthday', 'Home city', 'Gender', 'Profile images']
    },
    {
      category: 'Location & Coordinates',
      items: [
        'Approximate location (city/region)',
        'Precise GPS coordinates (latitude/longitude) when requested',
        'Location update timestamps for event logistics'
      ]
    },
    {
      category: 'Activity Data',
      items: ['Chats', 'Invitations', 'Events', 'Hosting interactions', 'Ratings']
    },
    {
      category: 'Preference Data',
      items: ['Interests', 'Values', 'Visibility settings', 'Language preferences']
    },
    {
      category: 'Technical Data',
      items: ['Device/browser metadata', 'IP/log records', 'Session events']
    }
  ],
  purposes: [
    'Operate profile, chat, event, and hosting features.',
    'Match relevant members and improve discovery quality.',
    'Support location-based matching and distance-aware event coordination.',
    'Detect abuse, spam, and suspicious platform activity.',
    'Support account requests and compliance processes.'
  ],
  retention: [
    'Account profile data: retained while account is active.',
    'Precise location coordinates: stored only for active location-enabled features and deleted when no longer required.',
    'Safety and audit logs: retained based on legal/compliance needs.',
    'Deleted accounts: data removed or anonymized after retention window.'
  ],
  sharing: [
    'Service providers for hosting, analytics, and support operations.',
    'Authorities only when required by applicable law.',
    'No sale of personal data.'
  ],
  security: [
    'Role-based access control for internal tools.',
    'Encrypted transport for data in transit.',
    'Operational monitoring and incident response procedures.'
  ]
};
