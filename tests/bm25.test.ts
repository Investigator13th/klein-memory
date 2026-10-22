import test from "node:test";
import assert from "node:assert/strict";
import { BM25Index, Tokenizer } from "../src/serving/bm25.js";
import { MemoryItem } from "../src/types.js";

test("Tokenizer segments English and Chinese terms", () => {
  const text = "DSH 记忆系统与推荐系统 RecSys";
  const tokens = Tokenizer.tokenize(text);
  assert.ok(tokens.includes("dsh"));
  assert.ok(tokens.includes("记忆"));
  assert.ok(tokens.includes("系统"));
  assert.ok(tokens.includes("recsys"));
});

test("BM25Index ranks most relevant documents highest", () => {
  const items: MemoryItem[] = [
    {
      id: "doc1",
      title: "关于推荐系统的架构设计",
      filePath: "doc1.md",
      metadata: { tags: ["推荐系统", "架构"] },
      fullContent: "基于增强型推荐系统的即时记忆引擎，包括多路召回与精排打分。",
      abstractContent: "增强型推荐系统即时记忆引擎",
      tokensFull: 50,
      tokensAbstract: 15,
      updatedTimestamp: Date.now(),
      halfLifeLambda: 0,
    },
    {
      id: "doc2",
      title: "烹饪与家常配餐",
      filePath: "doc2.md",
      metadata: { tags: ["美食", "做菜"] },
      fullContent: "西红柿炒鸡蛋与番茄牛腩的家常做法。",
      abstractContent: "西红柿家常菜",
      tokensFull: 40,
      tokensAbstract: 10,
      updatedTimestamp: Date.now(),
      halfLifeLambda: 0,
    },
    {
      id: "doc3",
      title: "DSH 插件开发指南",
      filePath: "doc3.md",
      metadata: { tags: ["DSH", "插件"] },
      fullContent: "如何编写一个符合 DSH 0.2.x 规范的 TypeScript 插件。",
      abstractContent: "DSH 插件开发",
      tokensFull: 45,
      tokensAbstract: 12,
      updatedTimestamp: Date.now(),
      halfLifeLambda: 0,
    },
  ];

  const index = new BM25Index();
  index.buildIndex(items);

  const results = index.search("推荐系统 召回 架构");
  assert.ok(results.length >= 1);
  assert.equal(results[0].item.id, "doc1");
  assert.ok(results[0].score > 0);

  const dshResults = index.search("TypeScript 插件");
  assert.ok(dshResults.length >= 1);
  assert.equal(dshResults[0].item.id, "doc3");
});
