# Implementation Plan: klein-memory (增强型推荐系统记忆引擎 MVP)

## 1. 架构设计概览

```
                        [用户实时输入 Query / Context]
                                      │
 ═════════════════════════════════════╪═════════════════════════════════════
 【klein-memory 在线 Serving 引擎】    │
 ─────────────────────────────────────┼─────────────────────────────────────
                                      ▼
                       ┌─────────────────────────────┐
                       │ 1. 资产索引与加载 (Loader)    │
                       │    读取本地 Markdown 资产    │
                       └──────────────┬──────────────┘
                                      ▼
                       ┌─────────────────────────────┐
                       │ 2. 多路召回引擎 (Recall)     │
                       │    - BM25 符号关键词召回     │
                       │    - 时间活跃流兜底         │
                       └──────────────┬──────────────┘
                                      ▼
                       ┌─────────────────────────────┐
                       │ 3. 多目标精排 (Scoring)      │
                       │    Score = w_rel*S_rel +    │
                       │      w_auth*S_auth +        │
                       │      w_rec*e^(-λ*Δt)        │
                       └──────────────┬──────────────┘
                                      ▼
                       ┌─────────────────────────────┐
                       │ 4. 0-1 背包 Token 预算求解   │
                       │    (Knapsack Budget Solver) │
                       │    自适应选择 L1摘要 或 L3全文│
                       └──────────────┬──────────────┘
                                      ▼
                       ┌─────────────────────────────┐
                       │ 5. 格式化输出 (Formatter)    │
                       │    生成 <klein-memory> XML  │
                       └─────────────────────────────┘
```

## 2. 任务拆解与执行路线

- **Task 1: 工程基础设施与配置**
  - 创建 `package.json`, `tsconfig.json`, `tsup.config.ts`, `cordis.patch.yml`。
  - 安装开发依赖（tsup, typescript, @types/node）。
- **Task 2: 核心类型与资产加载器 (Loader)**
  - 编写 `src/types.ts`。
  - 编写 `src/asset-loader.ts`，解析 Markdown Frontmatter 与正文，预估 Token 长度。
- **Task 3: BM25 检索算法与分词器 (Recall)**
  - 编写 `src/serving/bm25.ts`，实现中英文分词与 BM25 相关度计算。
  - 编写 `tests/bm25.test.ts` 进行单测。
- **Task 4: 多目标打分器 (Ranker)**
  - 编写 `src/serving/ranker.ts`，实现权威度加权与自适应半衰期退火。
  - 编写 `tests/ranker.test.ts` 进行单测。
- **Task 5: 0-1 背包 Token 预算动态求解器 (Knapsack)**
  - 编写 `src/serving/knapsack.ts`，实现渐进式多候选（Abstract vs Full）动态规划背包求解。
  - 编写 `tests/knapsack.test.ts` 进行数学与边界单测。
- **Task 6: Serving 引擎集成与 XML 格式化 (Engine & Formatter)**
  - 编写 `src/serving/engine.ts`，串联 Loader ➔ Recall ➔ Rank ➔ Knapsack。
  - 编写 `src/plugin/formatter.ts`，输出标准 XML 块。
  - 编写 `src/plugin/index.ts` 导出 DSH 插件。
- **Task 7: 自动化对比评测基准 (Benchmark)**
  - 编写 `tests/eval-benchmark.ts`，针对本地真实 `preferences/` 资产运行 Benchmark。
  - 输出 Token 压缩比、召回准确度及运行耗时分析。
