# DESIGN.md - klein-memory 视觉与交互规范

## 阶段规划
当前 MVP 聚焦于后端 RecSys 记忆服务引擎与 DSH `agent/pre-step` 报文合成。
后续阶段（P1/P2）若接入 Web GUI 侧边栏抽屉与知识图谱力导向图可视化，将遵循以下规范：

- 调色板基准：以 Slate/Neutral 为暗色低饱和背景，主强调色采用 DeepSeek Blue (`#0066FF`) 与 Klein Purple (`#8A2BE2`)。
- 图谱节点设计：
  - 核心偏好 (Preferences): 紫色圆形发光节点；
  - 实体/工具 (Entities): 蓝色矩形节点；
  - 历史事件 (Events): 灰色半透明圆角矩形。
- 文本排印：字体族使用系统等宽字体与 Inter 混合，严禁超过 3 级字体嵌套。
