import test from "node:test";
import assert from "node:assert/strict";
import { MultiObjectiveRanker } from "../src/serving/ranker.js";
import { MemoryItem } from "../src/types.js";

test("MultiObjectiveRanker correctly calculates authority and recency", () => {
  const ranker = new MultiObjectiveRanker();

  const permanentItem: MemoryItem = {
    id: "pref1",
    title: "博士长期画像",
    filePath: "pref1.md",
    metadata: { sourceTier: "L3_global", importance: 10, validUntil: "permanent" },
    fullContent: "博士的长期偏好",
    abstractContent: "博士偏好",
    tokensFull: 100,
    tokensAbstract: 20,
    updatedTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30天前
    halfLifeLambda: 0,
  };

  const ephemeralItem: MemoryItem = {
    id: "temp1",
    title: "临时构建报错日志",
    filePath: "temp1.md",
    metadata: { sourceTier: "L1_working", importance: 3 },
    fullContent: "npm install 临时警告",
    abstractContent: "临时警告",
    tokensFull: 100,
    tokensAbstract: 20,
    updatedTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 10, // 10天前
    halfLifeLambda: 0.15,
  };

  const authPerm = ranker.computeAuthorityScore(permanentItem);
  const authTemp = ranker.computeAuthorityScore(ephemeralItem);
  assert.ok(authPerm > authTemp);

  const recPerm = ranker.computeRecencyScore(permanentItem);
  const recTemp = ranker.computeRecencyScore(ephemeralItem);
  assert.equal(recPerm, 1.0); // 永久无衰减
  assert.ok(recTemp < 0.5);   // 10天后 λ=0.15 衰减显著 (e^-1.5 ≈ 0.22)

  // 综合精排：即使临时条目 BM25 得分稍高，权威与衰减使得核心偏好最终胜出
  const scored = ranker.rank([
    { item: ephemeralItem, score: 10 },
    { item: permanentItem, score: 9 },
  ]);

  assert.equal(scored[0].item.id, "pref1");
});
