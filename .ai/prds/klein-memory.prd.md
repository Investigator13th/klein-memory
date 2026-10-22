# PRD: klein-memory (增强型推荐系统记忆引擎)

## 1. 业务背景与愿景
当前 AI Agent 的记忆方案普遍陷入两极分化：
1. **外置重型服务**：如 OpenViking 等独立 Python FastAPI 服务，依赖独立守护进程与看门狗，不仅增加常驻内存（300MB~800MB），且跨进程通信时常因 Embedding 超时引发 MCP 假失败。
2. **玩具级粗暴拼接**：如普通 DSH 插件，使用粗糙的字符串匹配或无节制的 Top-K 向量截断，缺乏上下文 Token 预算意识，导致注意力稀释与 Token 浪费。

`klein-memory` 作为【克莱茵进化】项目第二阶段，立足于第一性原理，将智能体记忆同构为「增强型推荐系统（Enhanced RecSys）」，通过工业级推荐漏斗（召回 ➔ 粗排 ➔ 多目标精排 ➔ 0-1 背包预算求解）解决有限上下文窗口内的帕累托最优推荐。

## 2. 目标与衡量指标
- **端到端响应延迟**：Serving 检索打分与背包求解在 < 10ms 内完成（纯进程内执行）。
- **Token 节省率**：相比 Naive Top-K 静态截断，在保证核心关键事实无遗漏的前提下，Token 占用优化 30% 以上。
- **无感平滑迁移**：100% 兼容现有的本地 OpenViking Markdown 资产目录结构。

## 3. 功能范围划分

### 3.1 In Scope (P0 MVP 核心集)
1. **本地 Markdown 资产渐进式解析器**：只读读取 `preferences/` 与 `assistant/`，解析 Frontmatter（importance、tags、dates）及分级切片（L1 摘要 vs L3 全文）。
2. **BM25 符号检索与分词**：纯 Node.js/TS 实现支持中英文的轻量 BM25 索引器。
3. **多目标精排打分模型**：综合相关度得分、层级权威分（L3 系统级 > L2 阶段经验 > L1 临时状态）、时间自适应半衰期衰减函数。
4. **0-1 背包 Token 预算求解器**：根据传入的 Token 上限，在候选记忆的 L1 与 L3 切片间动态规划求解，求出最大效用组合。
5. **DSH 报文合成输出**：格式化为紧凑且语义清晰的 `<klein-memory>` XML 上下文块。
6. **自动化对比 Benchmark**：提供单测与实测脚本，量化对比 RecSys 背包方案与 Naive Top-K 方案。

### 3.2 Out of Scope (延后实现)
- DSH Web 侧边栏的交互式知识图谱力导向图 UI（P1）。
- 闲时触发的全局 LLM Auto-Dreaming 记忆聚类（P2）。
- 在评测跑通前，直接修改或接管现有的 OpenViking 写入链路（延后至正式迁移）。
