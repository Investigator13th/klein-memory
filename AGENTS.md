# klein-memory 工程规范契约

## 核心定位
`klein-memory` 是专为 DeepSeek Harness (DSH) 打造的增强型推荐系统同构认知记忆引擎（RecSys-Isomorphic Cognitive Memory OS）。
作为【克莱茵进化】项目第二阶段，它与第一阶段的 `klein-context-pruner`（上下文主动修剪）形成双螺旋协同：
- `klein-context-pruner`: 负责**释放**（Active Context Pruning，主动修剪过期消息，维持健康上下文窗口）。
- `klein-memory`: 负责**注入**（RecSys-Isomorphic Injection，在限定 Token 预算内求解最高 ROI 的记忆切片）。

## 开发纪律与技术原则
1. **纯 TS 进程内闭环**：零外部 Python 常驻进程，零复杂跨进程 RPC 通信，直接运行于 Node.js / DSH 进程内。
2. **单一真源与只读兼容**：开发与评测期间严格以 OpenViking 本地物理 Markdown 资产为只读真源，绝不破坏现有记忆文件。
3. **推荐系统同构架构**：
   - 多路召回（BM25 符号检索 + 活跃时间流）；
   - 多目标自适应半衰期评分（$S_{rel}, S_{auth}, \Delta t$ 衰减）；
   - 0-1 背包 Token 预算动态求解器（支持 L1 Abstract / L3 Full 渐进暴露）。
4. **测试驱动与基准验证**：核心算法（BM25、Ranker、Knapsack）必须保持 100% 单测覆盖，并提供可量化的 Benchmark 评测脚本。
5. **代码规范**：严格使用 ESM 模块化、TypeScript 静态类型校验、零编译警告。
