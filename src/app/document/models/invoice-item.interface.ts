export interface InvoiceItem {
  id: string;
  icon: string;
  ugyfel: string;
  status: string;
  irany: string;
  bizonylatTipus: string;
  bizonylatSzam: string;
  datetime: string;
  unread?: boolean;
  searchKey: string;
  items: InvoiceItemDetail[];
}

export interface InvoiceItemDetail {
  bizonylatSzam: string;
  status: string;
  datetime: string;
  bizonylatTipus: string;
  attachments: InvoiceAttachment[];
}

export interface InvoiceAttachment {
  name: string;
}

export interface InvoicePeriodItem {
  id: string;
  ugyfel: string;
  periodFrom: string;
  periodTo: string;
  idoszakLabel: string;
  status: string;
  searchKey: string;
}
