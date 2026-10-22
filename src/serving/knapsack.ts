import { ScoredMemory, SelectedMemory } from "../types.js";

export interface KnapsackConfig {
  abstractUtilityRatio?: number; // L1 摘要获得的效用比例，默认 0.65
  tokenBudget?: number;          // Token 预算硬上限，默认 1500
  tokenGranularity?: number;     // DP 步长粒度（用于大预算加速），默认 1
}

/**
 * 渐进式多重选择背包 Token 预算求解器 (Multiple-Choice Knapsack Solver)
 * 在硬 Token 预算限制下，在 不选 / L1摘要 / L3全文 三者间求解全局效用最大的帕累托最优解
 */
export class KnapsackBudgetSolver {
  private abstractUtilityRatio: number;
  private defaultBudget: number;

  constructor(config: KnapsackConfig = {}) {
    this.abstractUtilityRatio = config.abstractUtilityRatio ?? 0.65;
    this.defaultBudget = config.tokenBudget ?? 1500;
  }

  /**
   * 求解最优配置
   * @param candidates 经过精排打分的候选记忆
   * @param budget Token 预算上限
   */
  solve(candidates: ScoredMemory[], budget: number = this.defaultBudget): SelectedMemory[] {
    if (candidates.length === 0 || budget <= 0) return [];

    const n = candidates.length;
    const B = Math.floor(budget);

    // 备选状态：0 = None, 1 = Abstract, 2 = Full
    interface ItemChoice {
      cost: number;
      utility: number;
      level: "abstract" | "full" | "none";
    }

    const itemOptions: ItemChoice[][] = [];

    for (const cand of candidates) {
      const fullTokens = Math.max(1, cand.item.tokensFull);
      const absTokens = Math.max(1, Math.min(fullTokens, cand.item.tokensAbstract));

      const fullUtility = cand.finalScore;
      const absUtility = cand.finalScore * this.abstractUtilityRatio;

      itemOptions.push([
        { cost: 0, utility: 0, level: "none" },
        { cost: absTokens, utility: absUtility, level: "abstract" },
        { cost: fullTokens, utility: fullUtility, level: "full" },
      ]);
    }

    // 动态规划表：dp[i][w] 表示前 i 个物品、容量不超过 w 时的最大效用
    // 使用一维数组优化内存，同时维护 backtrack 表
    const dp = new Float64Array(B + 1).fill(0);
    // choiceTable[i * (B + 1) + w] 记录第 i 个物品在容量 w 下的选择 (0, 1, 2)
    const choiceTable = new Uint8Array(n * (B + 1));

    for (let i = 0; i < n; i++) {
      const options = itemOptions[i];
      const prevDp = Float64Array.from(dp);

      for (let w = 0; w <= B; w++) {
        let bestVal = prevDp[w];
        let bestChoice: 0 | 1 | 2 = 0;

        // 尝试选择 1: Abstract
        const opt1 = options[1];
        if (w >= opt1.cost) {
          const val1 = prevDp[w - opt1.cost] + opt1.utility;
          if (val1 > bestVal) {
            bestVal = val1;
            bestChoice = 1;
          }
        }

        // 尝试选择 2: Full
        const opt2 = options[2];
        if (w >= opt2.cost) {
          const val2 = prevDp[w - opt2.cost] + opt2.utility;
          if (val2 > bestVal) {
            bestVal = val2;
            bestChoice = 2;
          }
        }

        dp[w] = bestVal;
        choiceTable[i * (B + 1) + w] = bestChoice;
      }
    }

    // 回溯重建被选中的记忆与装载级别
    const selected: SelectedMemory[] = [];
    let currentWeight = B;

    for (let i = n - 1; i >= 0; i--) {
      const choice = choiceTable[i * (B + 1) + currentWeight];
      if (choice === 1) {
        const opt = itemOptions[i][1];
        selected.push({
          item: candidates[i].item,
          level: "abstract",
          allocatedTokens: opt.cost,
          utilityScore: opt.utility,
        });
        currentWeight -= opt.cost;
      } else if (choice === 2) {
        const opt = itemOptions[i][2];
        selected.push({
          item: candidates[i].item,
          level: "full",
          allocatedTokens: opt.cost,
          utilityScore: opt.utility,
        });
        currentWeight -= opt.cost;
      }
    }

    // 按最终效用降序返回
    selected.sort((a, b) => b.utilityScore - a.utilityScore);
    return selected;
  }
}
