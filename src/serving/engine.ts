import { loadMemoriesFromDirectory } from "../asset-loader.js";
import { MemoryItem, ServingConfig, ServingResult } from "../types.js";
import { BM25Index } from "./bm25.js";
import { KnapsackBudgetSolver } from "./knapsack.js";
import { MultiObjectiveRanker } from "./ranker.js";

/**
 * klein-memory 在线 Serving 引擎
 * 串联：资产加载 ➔ BM25 多路召回 ➔ 多目标精排打分 ➔ 0-1 背包 Token 预算求解
 */
export class RecSysMemoryEngine {
  private items: MemoryItem[] = [];
  private bm25Index: BM25Index;
  private ranker: MultiObjectiveRanker;
  private knapsack: KnapsackBudgetSolver;
  private config: ServingConfig;

  constructor(config: ServingConfig = {}) {
    this.config = config;
    this.bm25Index = new BM25Index();
    this.ranker = new MultiObjectiveRanker(config);
    this.knapsack = new KnapsackBudgetSolver({
      tokenBudget: config.tokenBudget ?? 1500,
    });
  }

  /**
   * 装载记忆资产列表或从目录扫描
   */
  loadItems(items: MemoryItem[]): void {
    this.items = items;
    this.bm25Index.buildIndex(items);
  }

  loadDirectory(dirPath: string): number {
    const items = loadMemoriesFromDirectory(dirPath);
    this.loadItems(items);
    return items.length;
  }

  getItems(): MemoryItem[] {
    return this.items;
  }

  /**
   * 执行在线 Serving 推荐流程
   */
  serve(query: string, runtimeConfig?: ServingConfig): ServingResult {
    const startTime = performance.now();
    const effectiveConfig = { ...this.config, ...runtimeConfig };
    const budget = effectiveConfig.tokenBudget ?? 1500;
    const minQueryLength = effectiveConfig.minQueryLength ?? 2;
    const candidateLimit = effectiveConfig.candidateLimit ?? 25;

    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < minQueryLength || this.items.length === 0) {
      return {
        query: trimmedQuery,
        budget,
        totalTokensUsed: 0,
        selectedMemories: [],
        candidateCount: 0,
        latencyMs: performance.now() - startTime,
      };
    }

    // Step 1: BM25 召回
    const rawCandidates = this.bm25Index.search(trimmedQuery, candidateLimit);

    // Step 2: 多目标精排 (相关度 + 权威级 + 时间半衰期)
    const scoredMemories = this.ranker.rank(rawCandidates);

    // Step 3: 0-1 背包 Token 预算动态求解 (自适应选 Abstract vs Full)
    const selected = this.knapsack.solve(scoredMemories, budget);

    const totalTokensUsed = selected.reduce((sum, s) => sum + s.allocatedTokens, 0);
    const latencyMs = performance.now() - startTime;

    return {
      query: trimmedQuery,
      budget,
      totalTokensUsed,
      selectedMemories: selected,
      candidateCount: rawCandidates.length,
      latencyMs,
    };
  }
}
