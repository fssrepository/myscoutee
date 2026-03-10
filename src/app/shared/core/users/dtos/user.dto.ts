export interface UserDto {
  id: string;
  name: string;
  age: number;
  birthday: string;
  city: string;
  height: string;
  physique: string;
  languages: string[];
  horoscope: string;
  initials: string;
  gender: 'woman' | 'man';
  statusText: string;
  hostTier: string;
  traitLabel: string;
  completion: number;
  headline: string;
  about: string;
  images?: string[];
  profileStatus: 'public' | 'friends only' | 'host only' | 'inactive';
  activities: {
    game: number;
    chat: number;
    invitations: number;
    events: number;
    hosting: number;
  };
}
