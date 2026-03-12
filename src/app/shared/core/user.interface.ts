export interface DemoUserListItemDto {
  id: string;
  name: string;
  city: string;
  initials: string;
  gender: 'woman' | 'man';
}

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

export interface UsersListQueryResponse {
  users: DemoUserListItemDto[];
}

export interface UserByIdQueryResponse {
  user: UserDto | null;
}

export interface UserGameBootstrapDto {
  filterCount: number;
  firstCardUserIds: string[];
}

export interface UserGameBootstrapQueryResponse {
  bootstrap: UserGameBootstrapDto | null;
}

export interface UserService {
  queryAvailableDemoUsers(): Promise<UsersListQueryResponse>;
  queryUserById(userId: string): Promise<UserByIdQueryResponse>;
  queryUserGameBootstrapById(userId: string): Promise<UserGameBootstrapQueryResponse>;
}
