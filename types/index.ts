/**
 * Centro 全局类型定义
 */

export interface Participant {
  name: string;
  address: string;
  location?: string; // 格式: "经度,纬度"
}

export interface POI {
  name: string;
  address: string;
  location: string;
  distance: string;
  tel: string;
  type: string;
  rating: string;
}

export interface RouteResult {
  origin: string;
  destination: string;
  mode: string;
  distance_km: number;
  duration_min: number;
}

export interface RouteForParticipant {
  participantName: string;
  duration_min: number;
  distance_km: number;
}

export interface Recommendation {
  poi: POI;
  routes: RouteForParticipant[];
  totalDuration: number;
  maxDuration: number;
}

export type AgentStatus =
  | "collecting"
  | "geocoding"
  | "searching"
  | "planning"
  | "ranking"
  | "done";

export interface GatherState {
  participants: Participant[];
  centerPoint?: string;
  keywords: string;
  city?: string;
  candidates: POI[];
  routes: RouteResult[];
  recommendations: Recommendation[];
  status: AgentStatus;
  missingInfo?: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}
