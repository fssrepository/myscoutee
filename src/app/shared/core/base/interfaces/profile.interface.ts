export interface ProfileRow {
  label: string;
  value: string;
  privacy: 'Public' | 'Friends' | 'Hosts' | 'Private';
}

export interface ProfileGroup {
  title: string;
  rows: ProfileRow[];
}
