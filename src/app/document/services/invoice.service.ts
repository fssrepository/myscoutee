import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { InvoiceItem, InvoicePeriodItem } from '../models/invoice-item.interface';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private ugyfelek = [
    'Kovács János',
    'Nagy Péter',
    'Szabó Anna',
    'Tóth Éva',
    'Varga László',
    'Kiss Katalin',
    'Molnár Gábor',
    'Horváth Zsuzsanna'
  ];

  private statuses = [
    'Felülbírálásra vár',
    'Felülvizsgálva',
    'Ellenőrzésre vár'
  ];

  private directions = ['Bejövő', 'Kimenő'];

  private bizonylatTipusok = ['Számla', 'Nyugta', 'Vámhatározat', 'Egyéb'];

  private invoices: InvoiceItem[] = [
    {
      id: 'inv-001',
      icon: 'receipt_long',
      ugyfel: 'Kovács János',
      status: 'Felülbírálásra vár',
      irany: 'Bejövő',
      bizonylatTipus: 'Számla',
      bizonylatSzam: 'BIZ-2026-000245',
      datetime: '2026-02-09 09:30',
      unread: true,
      searchKey: 'kovács jános biz-2026-000245 felülbírálásra vár bejövő számla',
      items: [
        {
          bizonylatSzam: 'BIZ-2026-000245',
          status: 'Felülbírálásra vár',
          datetime: '2026-02-09 09:30',
          bizonylatTipus: 'Számla',
          attachments: [
            { name: 'Szamla_000245.pdf' },
            { name: 'Szerzodes.pdf' }
          ]
        }
      ]
    },
    {
      id: 'inv-002',
      icon: 'receipt_long',
      ugyfel: 'Nagy Péter',
      status: 'Felülvizsgálva',
      irany: 'Kimenő',
      bizonylatTipus: 'Nyugta',
      bizonylatSzam: 'BIZ-2026-000232',
      datetime: '2026-02-08 14:15',
      unread: false,
      searchKey: 'nagy péter biz-2026-000232 felülvizsgálva kimenő nyugta',
      items: [
        {
          bizonylatSzam: 'BIZ-2026-000232',
          status: 'Felülvizsgálva',
          datetime: '2026-02-08 14:15',
          bizonylatTipus: 'Nyugta',
          attachments: [
            { name: 'Nyugta_000232.pdf' }
          ]
        },
        {
          bizonylatSzam: 'BIZ-2026-000232-A1',
          status: 'Felülvizsgálva',
          datetime: '2026-02-08 15:10',
          bizonylatTipus: 'Nyugta',
          attachments: [
            { name: 'Melleklet_000232_A1.pdf' }
          ]
        }
      ]
    },
    {
      id: 'inv-003',
      icon: 'description',
      ugyfel: 'Szabó Anna',
      status: 'Ellenőrzésre vár',
      irany: 'Bejövő',
      bizonylatTipus: 'Vámhatározat',
      bizonylatSzam: 'BIZ-2026-000198',
      datetime: '2026-02-05 08:05',
      unread: true,
      searchKey: 'szabó anna biz-2026-000198 ellenőrzésre vár bejövő vámhatározat',
      items: [
        {
          bizonylatSzam: 'BIZ-2026-000198',
          status: 'Ellenőrzésre vár',
          datetime: '2026-02-05 08:05',
          bizonylatTipus: 'Vámhatározat',
          attachments: [
            { name: 'Vamhat_000198.pdf' },
            { name: 'Mellekletek_000198.pdf' }
          ]
        }
      ]
    },
    {
      id: 'inv-004',
      icon: 'receipt',
      ugyfel: 'Tóth Éva',
      status: 'Felülvizsgálva',
      irany: 'Kimenő',
      bizonylatTipus: 'Számla',
      bizonylatSzam: 'BIZ-2026-000176',
      datetime: '2026-02-02 13:40',
      unread: false,
      searchKey: 'tóth éva biz-2026-000176 felülvizsgálva kimenő számla',
      items: [
        {
          bizonylatSzam: 'BIZ-2026-000176',
          status: 'Felülvizsgálva',
          datetime: '2026-02-02 13:40',
          bizonylatTipus: 'Számla',
          attachments: [
            { name: 'Szamla_000176.pdf' }
          ]
        }
      ]
    },
    {
      id: 'inv-005',
      icon: 'receipt',
      ugyfel: 'Varga László',
      status: 'Felülbírálásra vár',
      irany: 'Bejövő',
      bizonylatTipus: 'Egyéb',
      bizonylatSzam: 'BIZ-2026-000142',
      datetime: '2026-01-28 11:20',
      unread: false,
      searchKey: 'varga lászló biz-2026-000142 felülbírálásra vár bejövő egyéb',
      items: [
        {
          bizonylatSzam: 'BIZ-2026-000142',
          status: 'Felülbírálásra vár',
          datetime: '2026-01-28 11:20',
          bizonylatTipus: 'Egyéb',
          attachments: [
            { name: 'Egyeb_000142.pdf' }
          ]
        }
      ]
    },
    {
      id: 'inv-006',
      icon: 'receipt_long',
      ugyfel: 'Kiss Katalin',
      status: 'Ellenőrzésre vár',
      irany: 'Kimenő',
      bizonylatTipus: 'Számla',
      bizonylatSzam: 'BIZ-2026-000119',
      datetime: '2026-01-22 16:05',
      unread: false,
      searchKey: 'kiss katalin biz-2026-000119 ellenőrzésre vár kimenő számla',
      items: [
        {
          bizonylatSzam: 'BIZ-2026-000119',
          status: 'Ellenőrzésre vár',
          datetime: '2026-01-22 16:05',
          bizonylatTipus: 'Számla',
          attachments: [
            { name: 'Szamla_000119.pdf' },
            { name: 'Teljesitesi_igazolas.pdf' }
          ]
        }
      ]
    },
    {
      id: 'inv-007',
      icon: 'description',
      ugyfel: 'Molnár Gábor',
      status: 'Felülvizsgálva',
      irany: 'Bejövő',
      bizonylatTipus: 'Vámhatározat',
      bizonylatSzam: 'BIZ-2025-009881',
      datetime: '2025-12-18 10:12',
      unread: false,
      searchKey: 'molnár gábor biz-2025-009881 felülvizsgálva bejövő vámhatározat',
      items: [
        {
          bizonylatSzam: 'BIZ-2025-009881',
          status: 'Felülvizsgálva',
          datetime: '2025-12-18 10:12',
          bizonylatTipus: 'Vámhatározat',
          attachments: [
            { name: 'Vamhat_009881.pdf' }
          ]
        }
      ]
    },
    {
      id: 'inv-008',
      icon: 'receipt_long',
      ugyfel: 'Horváth Zsuzsanna',
      status: 'Ellenőrzésre vár',
      irany: 'Kimenő',
      bizonylatTipus: 'Nyugta',
      bizonylatSzam: 'BIZ-2025-009742',
      datetime: '2025-12-05 09:05',
      unread: true,
      searchKey: 'horváth zsuzsanna biz-2025-009742 ellenőrzésre vár kimenő nyugta',
      items: [
        {
          bizonylatSzam: 'BIZ-2025-009742',
          status: 'Ellenőrzésre vár',
          datetime: '2025-12-05 09:05',
          bizonylatTipus: 'Nyugta',
          attachments: [
            { name: 'Nyugta_009742.pdf' }
          ]
        }
      ]
    }
  ];

  private periods: InvoicePeriodItem[] = [
    {
      id: 'per-001',
      ugyfel: 'Kovács János',
      periodFrom: '2024-02-01',
      periodTo: '2024-02-29',
      idoszakLabel: '2024.02.01 - 2024.02.29',
      status: 'Nyitott',
      searchKey: 'kovács jános 2024.02.01 2024.02.29 nyitott biz-2026-000245 biz-2026-000232'
    },
    {
      id: 'per-002',
      ugyfel: 'Nagy Péter',
      periodFrom: '2024-01-01',
      periodTo: '2024-01-31',
      idoszakLabel: '2024.01.01 - 2024.01.31',
      status: 'Lezárt',
      searchKey: 'nagy péter 2024.01.01 2024.01.31 lezárt biz-2026-000232'
    },
    {
      id: 'per-003',
      ugyfel: 'Szabó Anna',
      periodFrom: '2023-12-01',
      periodTo: '2023-12-31',
      idoszakLabel: '2023.12.01 - 2023.12.31',
      status: 'Nyitott',
      searchKey: 'szabó anna 2023.12.01 2023.12.31 nyitott biz-2026-000198'
    },
    {
      id: 'per-004',
      ugyfel: 'Tóth Éva',
      periodFrom: '2024-03-01',
      periodTo: '2024-03-31',
      idoszakLabel: '2024.03.01 - 2024.03.31',
      status: 'Lezárt',
      searchKey: 'tóth éva 2024.03.01 2024.03.31 lezárt biz-2026-000176'
    },
    {
      id: 'per-005',
      ugyfel: 'Varga László',
      periodFrom: '2024-04-01',
      periodTo: '2024-04-30',
      idoszakLabel: '2024.04.01 - 2024.04.30',
      status: 'Nyitott',
      searchKey: 'varga lászló 2024.04.01 2024.04.30 nyitott biz-2026-000142'
    }
  ];

  getInvoices(): Observable<InvoiceItem[]> {
    return of(this.invoices);
  }

  searchInvoices(query: string): InvoiceItem[] {
    const q = query.toLowerCase();
    if (!q) return [];
    return this.invoices.filter(item => item.searchKey.includes(q));
  }

  getUgyfelek(): string[] {
    return this.ugyfelek;
  }

  getStatuses(): string[] {
    return this.statuses;
  }

  getDirections(): string[] {
    return this.directions;
  }

  getBizonylatTipusok(): string[] {
    return this.bizonylatTipusok;
  }

  getPeriods(): Observable<InvoicePeriodItem[]> {
    return of(this.periods);
  }

  searchPeriods(query: string): InvoicePeriodItem[] {
    const q = query.toLowerCase();
    if (!q) return [];
    return this.periods.filter(item => item.searchKey.includes(q));
  }
}
