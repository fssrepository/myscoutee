export type GroupType = 'dating' | 'work' | 'community';
export const GROUP_TYPES: readonly GroupType[] = ['dating', 'work', 'community'];
export const WORK_BASE_GROUP_ID = 'myscoutee-work';
export const COMMUNITY_BASE_GROUP_ID = 'myscoutee-community';
export const BASE_GROUP_IDS: readonly string[] = [WORK_BASE_GROUP_ID, COMMUNITY_BASE_GROUP_ID];
export function groupType(value: unknown): GroupType {
  return value === 'work' || value === 'community' ? value : 'dating';
}
export function baseGroupId(type: GroupType): string | null {
  return type === 'work' ? WORK_BASE_GROUP_ID : type === 'community' ? COMMUNITY_BASE_GROUP_ID : null;
}
export function baseGroupType(id: string | null | undefined): GroupType | null {
  return GROUP_TYPES.find(type => baseGroupId(type) === (id ?? null)) ?? null;
}
export function isBaseGroupId(id: string | null | undefined): boolean {
  return !!id && BASE_GROUP_IDS.includes(id);
}

export function groupPriorityEnabled(group: {id:string;groupType?:GroupType} | null | undefined): boolean {
  return group?.groupType !== 'community' || group.id === COMMUNITY_BASE_GROUP_ID;
}
