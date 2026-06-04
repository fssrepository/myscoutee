export const ADMIN_AFFINITY_GRAPH_STORE_KEY = 'adminAffinityGraph';

export interface AdminAffinityGraphNodeDto {
  id: string;
  name: string;
  initials: string;
  gender?: 'woman' | 'man' | string | null;
  city?: string | null;
  age?: number | null;
  headline?: string | null;
  traitLabel?: string | null;
  statusText?: string | null;
  profileStatus?: string | null;
  image?: string | null;
  images?: string[] | null;
  componentId?: string | null;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  degree?: number | null;
  weightedDegree?: number | null;
  centrality?: number | null;
  forestMemberCount?: number | null;
  forestEdgeCount?: number | null;
}

export interface AdminAffinityGraphEdgeDto {
  id: string;
  source: string;
  target: string;
  weight: number;
  affinityScore?: number | null;
  updatedDate?: string | null;
}

export interface AdminAffinityGraphDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  memberCount?: number | null;
  linkCount?: number | null;
  componentCount?: number | null;
  isolatedCount?: number | null;
  forestCount?: number | null;
  forestLevel?: number | null;
  maxForestLevel?: number | null;
  maxZoom?: number | null;
  labels?: Record<string, string> | null;
  nodes: AdminAffinityGraphNodeDto[];
  edges: AdminAffinityGraphEdgeDto[];
  forests?: AdminAffinityGraphForestDto[] | null;
}

export interface AdminAffinityGraphMetaDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  memberCount: number;
  linkCount: number;
  componentCount: number;
  isolatedCount: number;
  maxZoom: number;
  tileSize: number;
  nodeRenderBudget: number;
  edgeRenderBudget: number;
  materialized: boolean;
}

export interface AdminAffinityGraphNeighborhoodDto extends AdminAffinityGraphDto {
  centerUserId: string;
  depth: number;
}

export interface AdminAffinityGraphForestDto {
  componentId: string;
  representativeUserId: string;
  representativeName: string;
  representativeInitials: string;
  gender?: 'woman' | 'man' | string | null;
  memberCount: number;
  edgeCount: number;
  weightedDegree: number;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface AdminAffinityGraphForestsDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  forestCount?: number | null;
  forestLevel?: number | null;
  maxForestLevel?: number | null;
  limit?: number | null;
  offset?: number | null;
  forests: AdminAffinityGraphForestDto[];
}

export interface AdminAffinityGraphTileDto {
  generatedAtIso: string;
  source: 'demo' | 'http' | string;
  layoutVersion?: string | null;
  z: number;
  x: number;
  y: number;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  nodes: AdminAffinityGraphNodeDto[];
  edges: AdminAffinityGraphEdgeDto[];
}
