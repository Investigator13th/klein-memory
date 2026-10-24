# klein-memory 系统全景架构设计规范 (Architecture Spec)

> **设计定案日期**：2026-10-24  
> **核心原则**：真源归一，轻量闭环；图谱与向量只做轻量衍生层（Derivative Projections），坚决抵制重型常驻服务。

---

## 1. 总体认知架构：热区四大宪章 + 冷区知识档案库

系统严格解耦为**热区常驻总控（Hot Snapshot）**与**冷区按需检索（Cold Archive）**：

```
                    【克莱茵 × 博士 认知四大支柱 (Hot)】
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
    【克莱茵本体系】                                    【博士与世界交互系】
  • SOUL.md   (小助理人设与语气)                   • USER.md   (博士画像与核心偏好)
  • AGENTS.md (做事规矩与安全边界)                 • MEMORY.md (时序里程碑与因果大事件)
  ════════════════════════════════╪═════════════════════════════════════════════════
                                  ▼
                 【冷区资产档案库 (Cold Archive - memories/)】
            • memories/entities/   (细分实体与工具背景长案)
            • memories/events/     (历史会话与评测复盘实录)
            • memories/preferences/(细分垂直偏好长文档)
```

### 1.1 四大核心文件（根目录常驻真源）
1. **`SOUL.md`**：定义克莱茵的人设、世界观、语气与伴生使命（永远的生活小助理）；
2. **`AGENTS.md`**：工具调用契约、Windows 沙箱执行边界、文件变更纪律；
3. **`USER.md`**：博士的个人画像、长久生活/工作偏好、沟通习惯（L3 级全局稳定态）；
4. **`MEMORY.md`**：跨会话大事件总账本（Master Timeline / Ledger），以时间为轴串联重大决策与里程碑。

> **自主演化权限**：系统正式上线后，`USER.md` 与 `MEMORY.md` 开放给克莱茵自主维护与修剪。克莱茵在交互中感知偏好演进、记录重大里程碑，人类随时可在本地直接审阅与修改，零黑盒。

### 1.2 `MEMORY.md` 与多文件 Markdown 档案库的关系
- **`MEMORY.md` 是年表目录（Index / Ledger）**：单文件极简条目，每行 1~2 句话记录高密度大事件，并通过 Wikilink（如 `[[events/2026-10-24-95题横评]]`）建立跳转索引。每次会话热区直接拼入 Prompt，Token 消耗极小；
- **`memories/` 是深度卷宗（Atomic Dossiers）**：分散多文件存放长篇代码、详细评测日志、面试录音等细节。平时静默存在磁盘，**仅当 Query 命中时由检索器按需召回，杜绝上下文污染**；
- **自底向上晋升机制（Promotion）**：日常会话先在 `events/` 落盘，闲时反思（Dreaming）提炼出真正具备全局里程碑价值的条目，晋升追加至 `MEMORY.md`。

---

## 2. 向量定位与轻量化策略 (Vector Strategy)

### 2.1 架构定论：作为「第二路可选召回器」，坚决不做「主干强依赖」
- **坚决拒绝 OpenViking 模式**：严禁常驻外部 Python/FastAPI 守护进程，严禁实时切块 Embedding 阻塞热路径；
- **引入向量的必要性**：
  1. **跨词表语义联想**：解决 BM25 在模糊描述（如“清淡饮食” ➔ “白灼虾”）下的词表鸿沟；
  2. **工业级推荐系统完整性**：双路召回（BM25 符号倒排 + 向量稠密表征）构成完整的 RecSys 多路召回漏斗，工程故事扎实。

### 2.2 零常驻实现机制 (Zero-Daemon Embedding)
- **存储介质**：纯单文件向量缓存（`embeddings_cache.json` 或 SQLite-vec），只存冷区文档的向量嵌入；
- **离线生成**：新增或修改 Markdown 时，调用轻量在线 API（如 SiliconFlow BGE-M3）一次性异步更新向量缓存；
- **在线 Serving**：检索时直接在 Node.js 进程内做矩阵点积/余弦相似度计算（1000 篇文档点积 < 2ms），零外部守护进程。
- **可开可关**：热区 4 大文件永远零向量直出；冷区支持配置项 `vectorRecall: boolean`，无网/低成本环境下单靠 BM25 即可全功能运转。

---

## 3. 图谱与可视化策略 (Knowledge Graph Strategy)

### 3.1 架构定论：Obsidian 式自底向上力导向图，零图数据库依赖
- **坚决拒绝 Neo4j 模式**：不引入独立的图数据库服务，不引入 Cypher 查询语言；
- **轻量物化**：直接从 Markdown Frontmatter（`tags`, `category`）与正文双向链接（`[[...]]`）中即时解析图拓扑；
- **前端可视化**：Web 端通过轻量 D3.js / 2D Canvas 力导向图（Force-Directed Graph）动态渲染实体与偏好演进星系，提供极度震撼的可视化交互与面试演示效果。

---

## 4. 在线 Serving 漏斗总结 (Online RecSys Funnel)

```
[用户实时输入 Query]
       │
       ▼
【多路召回 (Recall)】
  ├─ 通道 1: 热区直通 (SOUL + AGENTS + USER + MEMORY) ➔ 100% 直出
  ├─ 通道 2: 符号检索 (纯 TS 内存 BM25 倒排索引) ➔ 毫秒级命中实体/关键词
  └─ 通道 3 (可选): 语义向量 (单文件内积余弦计算) ➔ 模糊语义泛化
       │
       ▼
【多目标精排 (Multi-Objective Ranker)】
  Score = w_rel*S_rel + w_auth*S_authority + w_rec*e^(-λ*Δt)
  (包含自适应半衰期退火与权威度分级)
       │
       ▼
【0-1 背包 Token 动态预算求解 (Knapsack Solver)】
  硬预算约束下，动态规划求解 ROI 最高的组合，自适应决策 L1摘要 / L3全文
       │
       ▼
【结构化 XML 注入】
  输出至 <klein-memory-context>
```
