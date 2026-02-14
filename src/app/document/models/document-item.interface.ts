export interface DocumentItem {
  id?: string;
  icon: string;
  name?: string;
  status?: string;
  ugyfel: string;
  formName?: string;
  datetime: string;
  unread?: boolean;
  searchKey: string;
  items?: DocumentItemDetail[];
}

export interface DocumentItemDetail {
  type?: string;
  name?: string;
  status?: string;
  formName?: string;
  datetime: string;
  iktatoszam: string;
  krSzam: string;
  attachments: DocumentAttachment[];
}

export interface DocumentAttachment {
  name: string;
}
