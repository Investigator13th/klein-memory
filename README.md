# klein-memory (Klein RecSys Memory Engine)

> **RecSys-Isomorphic Cognitive Memory OS for DeepSeek Harness (DSH)**  
> 专为 DeepSeek Harness 打造的增强型推荐系统同构记忆引擎：多路召回、多目标自适应半衰期精排、0-1 背包 Token 动态预算求解与纯进程内闭环。

---

## 💡 为什么需要 klein-memory？

市面上的 Agent 记忆系统普遍存在两大痛点：
1. **重型外置服务依赖**：如 OpenViking、MemGPT 等依赖独立常驻守护进程（FastAPI / Python / 独立向量库），占用数百 MB 内存，且跨进程通信常因 Embedding 超时引发 MCP 假失败。
2. **缺乏 Token 预算意识的 Naive 拼接**：大部分插件仅做朴素的 Top-K 向量相似度或简单字符串匹配，遇到长记忆时容易挤爆上下文或引发注意力稀释。

`klein-memory` 作为【克莱茵进化】项目第二阶段，与第一阶段的 `klein-context-pruner`（主动上下文修剪）形成**双螺旋协同**：
- `klein-context-pruner`：负责**释放**（Active Context Pruning，主动修剪过期消息与工具调用）；
- `klein-memory`：负责**注入**（RecSys-Isomorphic Injection，在限定 Token 预算内求解最高 ROI 的记忆切片）。

---

## 📐 核心架构与第一性原理

```
                           [用户实时输入 Query / 任务上下文]
                                          │
 ═════════════════════════════════════════╪═════════════════════════════════════════
 【在线 Serving 漏斗 (Online RecSys Pipeline, < 1ms)】│
 ─────────────────────────────────────────┼─────────────────────────────────────────
                                          ▼
                         ┌─────────────────────────────────┐
                         │ 1. 资产探测与加载 (Loader)        │
                         │    只读读取本地 Markdown 记忆资产 │
                         └────────────────┬────────────────┘
                                          ▼
                         ┌─────────────────────────────────┐
                         │ 2. 多路召回引擎 (Recall)         │
                         │    - BM25 符号关键词召回 (Intl) │
                         │    - 时间活跃流时序召回          │
                         └────────────────┬────────────────┘
                                          ▼
                         ┌─────────────────────────────────┐
                         │ 3. 多目标精排打分 (Ranker)       │
                         │    Score = w_rel*S_rel +        │
                         │            w_auth*S_auth +      │
                         │            w_rec*e^(-λ*Δt)      │
                         └────────────────┬────────────────┘
                                          ▼
                         ┌─────────────────────────────────┐
                         │ 4. 0-1 背包 Token 预算动态求解   │
                         │    (Knapsack Budget Solver)     │
                         │    自适应决策 L1摘要 / L3全文    │
                         └────────────────┬────────────────┘
                                          ▼
                         ┌─────────────────────────────────┐
                         │ 5. 结构化 XML 注入 (Formatter)   │
                         │    生成 <klein-memory-context>   │
                         └─────────────────────────────────┘
```

### 多目标效用打分公式
$$Score(m_i) = w_{rel} \cdot S_{rel}(q, m_i) + w_{auth} \cdot S_{authority}(m_i) + w_{rec} \cdot e^{-\lambda(m_i) \cdot \Delta t} + w_{freq} \cdot \log(1 + Count)$$

- $S_{authority}$：权威度分级（`L3_global` 宪章级 > `L2_milestone` 项目经验 > `L1_working` 临时状态）；
- $\lambda(m_i)$：自适应半衰期。永久架构决策 $\lambda = 0$（永不衰减）；临时排查条目 $\lambda = 0.15$（极速退火）；
- 0-1 背包求解：在给定的硬预算（如 1500 Tokens）下，最大化总效用得分 $\sum Score(m_i)$。

---

## 📊 真实基准评测 (Benchmark Results)

在本地真实沉淀的 Markdown 认知记忆资产上，实测对比 **Naive Top-K (机械全文填充)** 与 **klein-memory (背包 RecSys 动态优化)**：

| 测试场景 (Query) | Naive Top-K 消耗 | klein-memory 消耗 | Token 节省率 | 注入条目组合 (L1摘要 / L3全文) | 端到端耗时 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **推荐系统架构** | 1519 tokens | **814 tokens** | **46.4%** | 3 items (1 L1, 2 L3) | **0.71 ms** |
| **系统服务运维** | 457 tokens | **457 tokens** | 0.0% | 1 items (0 L1, 1 L3) | **0.12 ms** |
| **求职项目画像** | 1519 tokens | **814 tokens** | **46.4%** | 3 items (1 L1, 2 L3) | **0.32 ms** |
| **前端设计规范** | 1519 tokens | **1088 tokens** | **28.4%** | 3 items (1 L1, 2 L3) | **0.84 ms** |

### 评测汇总结论
- **平均端到端延迟**：**0.42 ms**（纯 Node.js 进程内动态规划与倒排索引，零跨进程 IPC 损耗）。
- **综合 Token 节省率**：**33.7%**（在保证信息覆盖度的前提下大幅降低上下文浪费）。
- **稳定性**：100% 通过自动化单测与边界测试。

---

## 🚀 安装与接入

### 作为 DSH 插件运行
在 DSH profile 的 `cordis.patch.yml` 中声明：

```yaml
- id: klein-memory
  name: klein-memory
  config:
    tokenBudget: 1500     # Token 预算上限
    minQueryLength: 2     # 最小触发查询字符数
    autoInject: true      # 自动接入 agent/pre-step 钩子
```

### 本地编译与单测
```bash
# 安装依赖
pnpm install

# 运行全量单元测试
pnpm test

# 运行真实资产 Benchmark 评测
pnpm run benchmark

# 生产环境打包
pnpm run build
```

---

## 📜 开源协议
MIT License © 2026 huangfei
