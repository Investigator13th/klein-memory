import { ServingResult } from "../types.js";

/**
 * 将 ServingResult 渲染为语义清晰、紧凑的 XML 记忆上下文块
 */
export function formatMemoryContext(result: ServingResult): string {
  if (result.selectedMemories.length === 0) {
    return "";
  }

  const lines: string[] = [
    `<klein-memory-context query="${escapeXml(result.query)}" budget="${result.budget}" used="${result.totalTokensUsed}" latency="${result.latencyMs.toFixed(1)}ms">`,
    `  <!-- 以下内容由 klein-memory 推荐系统根据当前任务在 Token 预算内精选注入 -->`,
  ];

  for (const selected of result.selectedMemories) {
    const item = selected.item;
    const content = selected.level === "full" ? item.fullContent : item.abstractContent;
    const scoreStr = selected.utilityScore.toFixed(2);

    lines.push(
      `  <memory-block id="${escapeXml(item.id)}" score="${scoreStr}" level="${selected.level}" tokens="${selected.allocatedTokens}">`
    );
    // 缩进正文
    const indentedContent = content
      .split("\n")
      .map(line => `    ${line}`)
      .join("\n");
    lines.push(indentedContent);
    lines.push(`  </memory-block>`);
  }

  lines.push(`</klein-memory-context>`);
  return lines.join("\n");
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
