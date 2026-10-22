import test from "node:test";
import assert from "node:assert/strict";
import { KnapsackBudgetSolver } from "../src/serving/knapsack.js";
import { MemoryItem, ScoredMemory } from "../src/types.js";

function createDummyScored(id: string, fullTokens: number, absTokens: number, score: number): ScoredMemory {
  const item: MemoryItem = {
    id,
    title: `Title ${id}`,
    filePath: `${id}.md`,
    metadata: {},
    fullContent: `Full ${id}`,
    abstractContent: `Abstract ${id}`,
    tokensFull: fullTokens,
    tokensAbstract: absTokens,
    updatedTimestamp: Date.now(),
    halfLifeLambda: 0,
  };

  return {
    item,
    finalScore: score,
    bm25Score: score,
    authorityScore: score,
    recencyScore: 1.0,
    frequencyScore: 0,
  };
}

test("KnapsackBudgetSolver respects strict token budget", () => {
  const candidates: ScoredMemory[] = [
    createDummyScored("item1", 500, 50, 0.95),
    createDummyScored("item2", 400, 40, 0.90),
    createDummyScored("item3", 600, 60, 0.85),
    createDummyScored("item4", 300, 30, 0.80),
  ];

  const solver = new KnapsackBudgetSolver();
  const budget = 200; // 较紧的预算
  const selected = solver.solve(candidates, budget);

  const totalTokens = selected.reduce((sum, s) => sum + s.allocatedTokens, 0);
  assert.ok(totalTokens <= budget, `Total tokens ${totalTokens} must be <= budget ${budget}`);
  assert.ok(selected.length > 0);

  // 在 200 token 紧预算下，应该多选几条高分的 Abstract，而不是塞满一条 Full 就溢出
  const abstractCount = selected.filter(s => s.level === "abstract").length;
  assert.ok(abstractCount >= 2, "Solver should prefer multiple high-ROI abstracts under tight budget");
});

test("KnapsackBudgetSolver upgrades to Full when budget is ample", () => {
  const candidates: ScoredMemory[] = [
    createDummyScored("item1", 300, 50, 0.95),
  ];

  const solver = new KnapsackBudgetSolver();
  const selected = solver.solve(candidates, 1000);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].level, "full");
  assert.equal(selected[0].allocatedTokens, 300);
});

test("KnapsackBudgetSolver handles empty input and zero budget", () => {
  const solver = new KnapsackBudgetSolver();
  assert.deepEqual(solver.solve([], 1000), []);
  assert.deepEqual(solver.solve([createDummyScored("item1", 100, 20, 0.8)], 0), []);
});
