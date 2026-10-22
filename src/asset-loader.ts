import fs from "node:fs";
import path from "node:path";
import { MemoryItem, MemoryMetadata, SourceTier } from "./types.js";

/**
 * 极简快速 Token 估算器（中英文混合启发式）
 * 中文字符约 1~1.3 token，英文单词约 1.2 token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // 匹配 CJK 字符
  const cjkMatches = text.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  // 匹配非 CJK 单词
  const nonCjkText = text.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, " ");
  const wordMatches = nonCjkText.trim().match(/\S+/g);
  const wordCount = wordMatches ? wordMatches.length : 0;

  return Math.ceil(cjkCount * 1.1 + wordCount * 1.3);
}

/**
 * 轻量纯 TS Frontmatter 解析器
 */
export function parseFrontmatter(content: string): { metadata: MemoryMetadata; body: string } {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return { metadata: {}, body: content };
  }

  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { metadata: {}, body: content };
  }

  const rawYaml = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 4).trim();
  const metadata: MemoryMetadata = {};

  const lines = rawYaml.split("\n");
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let val = line.slice(colonIndex + 1).trim();

    // 去除引号
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    if (key === "importance") {
      metadata.importance = Number(val) || 5;
    } else if (key === "source_tier" || key === "sourceTier") {
      metadata.sourceTier = val as SourceTier;
    } else if (key === "created_at" || key === "createdAt") {
      metadata.createdAt = val;
    } else if (key === "updated_at" || key === "updatedAt") {
      metadata.updatedAt = val;
    } else if (key === "valid_until" || key === "validUntil") {
      metadata.validUntil = val;
    } else if (key === "tags") {
      if (val.startsWith("[") && val.endsWith("]")) {
        metadata.tags = val.slice(1, -1).split(",").map(t => t.trim().replace(/^['"]|['"]$/g, ""));
      } else {
        metadata.tags = [val];
      }
    } else {
      metadata[key] = val;
    }
  }

  return { metadata, body };
}

/**
 * 从文本中提取紧凑 L1 摘要
 */
export function extractAbstract(body: string, title: string): string {
  // 查找是否有显式摘要标记，例如 ## 摘要 或 > 摘要
  const explicitAbstractMatch = body.match(/(?:##\s*摘要|>+\s*)([^\n]+(?:\n[^\n]+){0,2})/i);
  if (explicitAbstractMatch && explicitAbstractMatch[1]) {
    return explicitAbstractMatch[1].trim();
  }

  // 提取正文首部有意义的内容（过滤 Markdown 标题行）
  const lines = body.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#"));

  if (lines.length > 0) {
    // 取前 1~2 行
    const summary = lines.slice(0, 2).join(" ");
    return summary.length > 180 ? summary.slice(0, 180) + "..." : summary;
  }

  return title;
}

/**
 * 根据元数据与重要性计算时间半衰期衰减速率 λ
 */
export function calculateHalfLifeLambda(meta: MemoryMetadata): number {
  if (meta.validUntil === "permanent" || meta.sourceTier === "L3_global") {
    return 0.0; // 永久架构决策，衰减速率为 0
  }
  const importance = meta.importance ?? 5;
  if (importance >= 9) return 0.002; // 半衰期 ~350 天
  if (importance >= 7) return 0.01;  // 半衰期 ~70 天
  if (meta.sourceTier === "L2_milestone") return 0.02; // 半衰期 ~35 天
  if (meta.sourceTier === "L1_working") return 0.15;   // 半衰期 ~4.6 天
  return 0.05; // 默认半衰期 ~14 天
}

/**
 * 从单个文件解析 MemoryItem
 */
export function loadMemoryFromFile(filePath: string, baseDir?: string): MemoryItem | null {
  try {
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const { metadata, body } = parseFrontmatter(rawContent);

    const relativeId = baseDir ? path.relative(baseDir, filePath).replace(/\\/g, "/") : path.basename(filePath);
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));

    // 标题：正文首个 # 标题或文件名
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : fileNameWithoutExt;

    const abstractContent = extractAbstract(body, title);
    const tokensFull = estimateTokens(body);
    const tokensAbstract = estimateTokens(abstractContent);

    // 解析时间戳
    let updatedTimestamp = Date.now();
    if (metadata.updatedAt) {
      const parsed = Date.parse(metadata.updatedAt);
      if (!isNaN(parsed)) updatedTimestamp = parsed;
    } else if (metadata.createdAt) {
      const parsed = Date.parse(metadata.createdAt);
      if (!isNaN(parsed)) updatedTimestamp = parsed;
    } else {
      const stat = fs.statSync(filePath);
      updatedTimestamp = stat.mtimeMs;
    }

    const halfLifeLambda = calculateHalfLifeLambda(metadata);

    return {
      id: relativeId,
      title,
      filePath,
      metadata,
      fullContent: body,
      abstractContent,
      tokensFull,
      tokensAbstract,
      updatedTimestamp,
      halfLifeLambda,
    };
  } catch {
    return null;
  }
}

/**
 * 递归加载指定目录下的所有 Markdown 记忆文件
 */
export function loadMemoriesFromDirectory(dirPath: string): MemoryItem[] {
  const results: MemoryItem[] = [];
  if (!fs.existsSync(dirPath)) return results;

  function scan(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const item = loadMemoryFromFile(fullPath, dirPath);
        if (item) results.push(item);
      }
    }
  }

  scan(dirPath);
  return results;
}
