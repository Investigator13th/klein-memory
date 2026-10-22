import test from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, extractAbstract, estimateTokens, calculateHalfLifeLambda } from "../src/asset-loader.js";

test("parseFrontmatter parses valid YAML frontmatter", () => {
  const md = `---
created_at: "2026-10-21 10:00"
importance: 9
source_tier: "L3_global"
valid_until: "permanent"
tags: [memory, recsys]
---

# 记忆系统架构

正文内容：智能体记忆是一个增强型推荐系统。
`;

  const { metadata, body } = parseFrontmatter(md);
  assert.equal(metadata.importance, 9);
  assert.equal(metadata.sourceTier, "L3_global");
  assert.equal(metadata.validUntil, "permanent");
  assert.deepEqual(metadata.tags, ["memory", "recsys"]);
  assert.ok(body.includes("智能体记忆是一个增强型推荐系统"));
});

test("calculateHalfLifeLambda returns 0 for permanent items", () => {
  assert.equal(calculateHalfLifeLambda({ validUntil: "permanent" }), 0);
  assert.equal(calculateHalfLifeLambda({ sourceTier: "L3_global" }), 0);
  assert.equal(calculateHalfLifeLambda({ sourceTier: "L1_working" }), 0.15);
});

test("estimateTokens provides reasonable token estimates", () => {
  const shortZh = "这是一个简短的中文测试。";
  const tokens = estimateTokens(shortZh);
  assert.ok(tokens >= 10 && tokens <= 25);
});
