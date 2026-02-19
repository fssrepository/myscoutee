export const MENU_BADGES = {
  home: 0,
  documents: 3,
  invoices: 2
} as const;

export const MENU_BADGES_TOTAL = Object.values(MENU_BADGES).reduce<number>(
  (sum, value) => sum + value,
  0
);

export const USER_BADGE_COUNT = 1;
