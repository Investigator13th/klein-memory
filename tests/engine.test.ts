import test from "node:test";
import assert from "node:assert/strict";
import { RecSysMemoryEngine } from "../src/serving/engine.js";
import { formatMemoryContext } from "../src/plugin/formatter.js";
import { MemoryItem } from "../src/types.js";

test("RecSysMemoryEngine end-to-end serve and format", () => {
  const items: MemoryItem[] = [
    {
      id: "pref/recsys",
      title: "增强型推荐系统记忆理论",
      filePath: "recsys.md",
      metadata: { sourceTier: "L3_global", importance: 10, validUntil: "permanent" },
      fullContent: "基于增强型推荐系统同构智能体记忆，包括多路召回、多目标打分与背包算法。",
      abstractContent: "增强型推荐系统同构智能体记忆理论",
      tokensFull: 120,
      tokensAbstract: 25,
      updatedTimestamp: Date.now(),
      halfLifeLambda: 0,
    },
    {
      id: "pref/cooking",
      title: "杭州家常菜谱",
      filePath: "cooking.md",
      metadata: { sourceTier: "L2_milestone", importance: 6 },
      fullContent: "家常配餐与两人份菜品搭配指南。",
      abstractContent: "家常配餐菜谱",
      tokensFull: 80,
      tokensAbstract: 18,
      updatedTimestamp: Date.now(),
      halfLifeLambda: 0.02,
    },
  ];

  const engine = new RecSysMemoryEngine({ tokenBudget: 200 });
  engine.loadItems(items);

  const result = engine.serve("推荐系统 记忆理论 召回");
  assert.equal(result.query, "推荐系统 记忆理论 召回");
  assert.ok(result.selectedMemories.length >= 1);
  assert.equal(result.selectedMemories[0].item.id, "pref/recsys");
  assert.ok(result.totalTokensUsed <= 200);
  assert.ok(result.latencyMs < 50, `Serving latency should be < 50ms, got ${result.latencyMs}ms`);

  const formattedXml = formatMemoryContext(result);
  assert.ok(formattedXml.includes("<klein-memory-context"));
  assert.ok(formattedXml.includes("pref/recsys"));
  assert.ok(formattedXml.includes("</klein-memory-context>"));
});
