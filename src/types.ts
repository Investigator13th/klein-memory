/**
 * klein-memory 核心数据结构与契约定义
 */

export type SourceTier = "L3_global" | "L2_milestone" | "L1_working";

export interface MemoryMetadata {
  createdAt?: string;
  updatedAt?: string;
  validUntil?: string;
  importance?: number; // 1 ~ 10
  status?: string;
  sourceTier?: SourceTier;
  tags?: string[];
  [key: string]: unknown;
}

export interface MemoryItem {
  id: string; // 唯一标识，如 "preferences/博士/Agent Memory 认知观点.md"
  title: string;
  filePath: string;
  metadata: MemoryMetadata;
  fullContent: string;
  abstractContent: string;
  tokensFull: number;
  tokensAbstract: number;
  updatedTimestamp: number; // 毫秒时间戳，用于时间半衰期衰减
  halfLifeLambda: number; // 自适应半衰期衰减速率 λ
}

export interface RecallCandidate {
  item: MemoryItem;
  bm25Score: number;
  recencyScore: number;
}

export interface ScoredMemory {
  item: MemoryItem;
  finalScore: number;
  bm25Score: number;
  authorityScore: number;
  recencyScore: number;
  frequencyScore: number;
}

export type ExposureLevel = "abstract" | "full";

export interface SelectedMemory {
  item: MemoryItem;
  level: ExposureLevel;
  allocatedTokens: number;
  utilityScore: number;
}

export interface ServingResult {
  query: string;
  budget: number;
  totalTokensUsed: number;
  selectedMemories: SelectedMemory[];
  candidateCount: number;
  latencyMs: number;
}

export interface ServingConfig {
  tokenBudget?: number;
  minQueryLength?: number;
  weightRel?: number;
  weightAuth?: number;
  weightRec?: number;
  weightFreq?: number;
  candidateLimit?: number;
}
