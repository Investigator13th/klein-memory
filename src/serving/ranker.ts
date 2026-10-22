import { MemoryItem, ScoredMemory, ServingConfig } from "../types.js";

export class MultiObjectiveRanker {
  private weightRel: number;
  private weightAuth: number;
  private weightRec: number;
  private weightFreq: number;

  constructor(config: ServingConfig = {}) {
    this.weightRel = config.weightRel ?? 0.50;
    this.weightAuth = config.weightAuth ?? 0.25;
    this.weightRec = config.weightRec ?? 0.20;
    this.weightFreq = config.weightFreq ?? 0.05;
  }

  /**
   * 计算权威度分 S_auth ∈ [0, 1]
   */
  computeAuthorityScore(item: MemoryItem): number {
    const tier = item.metadata.sourceTier;
    const importance = item.metadata.importance ?? 5;

    if (tier === "L3_global") {
      return 0.85 + (importance / 10) * 0.15; // 0.85 ~ 1.00
    }
    if (tier === "L2_milestone") {
      return 0.55 + (importance / 10) * 0.25; // 0.55 ~ 0.80
    }
    if (tier === "L1_working") {
      return 0.15 + (importance / 10) * 0.25; // 0.15 ~ 0.40
    }

    return Math.min(1.0, Math.max(0.1, importance / 10));
  }

  /**
   * 计算自适应半衰期新鲜度得分 S_rec = e^(-λ * Δt) ∈ (0, 1]
   */
  computeRecencyScore(item: MemoryItem, nowMs: number = Date.now()): number {
    if (item.halfLifeLambda <= 0) {
      return 1.0; // 永久架构决策，无衰减
    }

    const elapsedMs = Math.max(0, nowMs - item.updatedTimestamp);
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-item.halfLifeLambda * elapsedDays);

    return Math.max(0.001, Math.min(1.0, decay));
  }

  /**
   * 对召回候选集执行多目标精排打分
   * @param candidates 包含原始 BM25 分数的候选列表
   * @param nowMs 当前时间戳
   */
  rank(
    candidates: Array<{ item: MemoryItem; score: number }>,
    nowMs: number = Date.now()
  ): ScoredMemory[] {
    if (candidates.length === 0) return [];

    // 找到最高 BM25 得分用于归一化
    let maxBm25 = 0;
    for (const c of candidates) {
      if (c.score > maxBm25) maxBm25 = c.score;
    }
    if (maxBm25 <= 0) maxBm25 = 1.0;

    const scoredList: ScoredMemory[] = [];

    for (const c of candidates) {
      // 1. 归一化相关度
      const normalizedBm25 = c.score / maxBm25;
      // 2. 权威度得分
      const authScore = this.computeAuthorityScore(c.item);
      // 3. 时序半衰期得分
      const recScore = this.computeRecencyScore(c.item, nowMs);
      // 4. 频次得分
      const freqScore = 0.0;

      // 多目标加权融合
      const finalScore =
        this.weightRel * normalizedBm25 +
        this.weightAuth * authScore +
        this.weightRec * recScore +
        this.weightFreq * freqScore;

      scoredList.push({
        item: c.item,
        finalScore,
        bm25Score: normalizedBm25,
        authorityScore: authScore,
        recencyScore: recScore,
        frequencyScore: freqScore,
      });
    }

    // 降序排序
    scoredList.sort((a, b) => b.finalScore - a.finalScore);
    return scoredList;
  }
}
