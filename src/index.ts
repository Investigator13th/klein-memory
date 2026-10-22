export * from "./types.js";
export * from "./asset-loader.js";
export * from "./serving/bm25.js";
export * from "./serving/ranker.js";
export * from "./serving/knapsack.js";
export * from "./serving/engine.js";
export * from "./plugin/formatter.js";
export * from "./plugin/index.js";

import { apply, name, inject } from "./plugin/index.js";
export default { name, inject, apply };
