import { RecSysMemoryEngine } from "../serving/engine.js";
import { formatMemoryContext } from "./formatter.js";
import { ServingConfig } from "../types.js";
import path from "node:path";
import fs from "node:fs";

export const name = "klein-memory";
export const inject = ["agents", "sessions", "tools"];

export interface KleinMemoryPluginConfig extends ServingConfig {
  dataDir?: string;
  autoInject?: boolean;
}

export function apply(ctx: any, config: KleinMemoryPluginConfig = {}) {
  const engine = new RecSysMemoryEngine(config);

  // 默认探测本地历史记忆库目录
  const defaultDir = "C:\\Users\\huangfei\\Documents\\Antigravity\\Klein\\openviking\\data\\viking\\klein\\user\\huangfei\\preferences";
  const targetDir = config.dataDir || defaultDir;

  if (fs.existsSync(targetDir)) {
    const count = engine.loadDirectory(targetDir);
    if (ctx.logger) {
      ctx.logger.info?.(`[klein-memory] Successfully indexed ${count} memories from ${targetDir}`);
    }
  }

  // 注册服务至 Cordis 上下文
  if (typeof ctx.provide === "function") {
    ctx.provide("kleinMemory", engine);
  }

  if (config.autoInject !== false) {
    // 监听 DSH agent/pre-step 钩子，执行即时记忆推荐装载
    ctx.on("agent/pre-step", async ({ agent, messages, signal }: any, next: () => Promise<any>) => {
      const decision = await next();
      if (!decision || decision.kind !== "enter" || signal?.aborted) {
        return decision;
      }

      const query = extractLatestUserQuery(decision.messages || messages);
      if (!query) return decision;

      const result = engine.serve(query, {
        tokenBudget: config.tokenBudget ?? 1500,
        minQueryLength: config.minQueryLength ?? 2,
      });

      const formattedBlock = formatMemoryContext(result);
      if (!formattedBlock) return decision;

      const memoryMessage = {
        role: "user",
        content: [{ type: "text", text: formattedBlock }],
      };

      return {
        kind: "enter",
        messages: [...decision.messages, memoryMessage],
      };
    }, { prepend: true });
  }

  return engine;
}

/**
 * 从最新会话消息列表中提取用户查询文本
 */
export function extractLatestUserQuery(messages: any[]): string {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      if (typeof msg.content === "string") return msg.content;
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((c: any) => c && c.type === "text" && typeof c.text === "string")
          .map((c: any) => c.text);
        if (textParts.length > 0) return textParts.join(" ");
      }
    }
  }
  return "";
}
