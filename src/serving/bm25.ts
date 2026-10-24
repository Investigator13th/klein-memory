import { MemoryItem } from "../types.js";

/**
 * 分词器：使用 Node 原生 Intl.Segmenter 分词，支持中文自然词与英文单词
 */
export class Tokenizer {
  private static segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

  static tokenize(text: string): string[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    const tokens: string[] = [];
    const segments = this.segmenter.segment(lower);

    for (const segment of segments) {
      if (segment.isWordLike) {
        const word = segment.segment;
        tokens.push(word);

        // 针对英文执行轻量词干归一化 (复数、ing/ed 去除，解决 podcast vs podcasts, film vs films 的词表鸿沟)
        if (/^[a-z]+$/.test(word) && word.length > 3) {
          if (word.endsWith("ies") && word.length > 4) {
            tokens.push(word.slice(0, -3) + "y");
          } else if (word.endsWith("es") && word.length > 4) {
            tokens.push(word.slice(0, -2));
          } else if (word.endsWith("s") && !word.endsWith("ss")) {
            tokens.push(word.slice(0, -1));
          } else if (word.endsWith("ing") && word.length > 5) {
            tokens.push(word.slice(0, -3));
          } else if (word.endsWith("ed") && word.length > 4) {
            tokens.push(word.slice(0, -2));
          }
        }
      }
    }

    // 针对中文，追加 2-gram 字符片段以提升简短术语召回率
    const cjkChars = lower.replace(/[^\u4e00-\u9fa5]/g, "");
    if (cjkChars.length >= 2) {
      for (let i = 0; i < cjkChars.length - 1; i++) {
        tokens.push(cjkChars.slice(i, i + 2));
      }
    }

    return tokens;
  }
}

export interface DocumentPosting {
  docIndex: number;
  termFreq: number;
}

export interface BM25Config {
  k1?: number; // 词频饱和度，默认 1.5
  b?: number;  // 长度归一化权重，默认 0.75
  titleWeight?: number;
  tagWeight?: number;
}

/**
 * 轻量内存 BM25 索引器
 */
export class BM25Index {
  private documents: MemoryItem[] = [];
  private docLengths: number[] = [];
  private avgDocLength = 0;
  private invertedIndex = new Map<string, DocumentPosting[]>();
  private k1: number;
  private b: number;
  private titleWeight: number;
  private tagWeight: number;

  constructor(config: BM25Config = {}) {
    this.k1 = config.k1 ?? 1.5;
    this.b = config.b ?? 0.75;
    this.titleWeight = config.titleWeight ?? 3.0;
    this.tagWeight = config.tagWeight ?? 2.5;
  }

  /**
   * 构建倒排索引
   */
  buildIndex(items: MemoryItem[]): void {
    this.documents = items;
    this.docLengths = new Array(items.length).fill(0);
    this.invertedIndex.clear();

    let totalLength = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleTokens = Tokenizer.tokenize(item.title);
      const tagTokens = Tokenizer.tokenize((item.metadata.tags || []).join(" "));
      const bodyTokens = Tokenizer.tokenize(item.fullContent);

      const termCounts = new Map<string, number>();

      // 标题词加权
      for (const t of titleTokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + this.titleWeight);
      }
      // 标签词加权
      for (const t of tagTokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + this.tagWeight);
      }
      // 正文词
      for (const t of bodyTokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + 1.0);
      }

      const length = titleTokens.length * this.titleWeight + tagTokens.length * this.tagWeight + bodyTokens.length;
      this.docLengths[i] = length;
      totalLength += length;

      for (const [term, count] of termCounts.entries()) {
        let postings = this.invertedIndex.get(term);
        if (!postings) {
          postings = [];
          this.invertedIndex.set(term, postings);
        }
        postings.push({ docIndex: i, termFreq: count });
      }
    }

    this.avgDocLength = items.length > 0 ? totalLength / items.length : 1;
  }

  /**
   * 计算 Robertson-Spärck Jones IDF
   */
  private idf(docFreq: number, totalDocs: number): number {
    return Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));
  }

  /**
   * 执行 BM25 相关度检索打分
   * @param query 用户查询
   * @param topK 返回候选数量上限
   */
  search(query: string, topK = 20): Array<{ item: MemoryItem; score: number }> {
    const queryTokens = Tokenizer.tokenize(query);
    if (queryTokens.length === 0 || this.documents.length === 0) {
      return [];
    }

    const scores = new Float64Array(this.documents.length);
    const totalDocs = this.documents.length;

    // 对 Query 词去重计算
    const uniqueQueryTerms = Array.from(new Set(queryTokens));

    for (const term of uniqueQueryTerms) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;

      const docFreq = postings.length;
      const termIdf = this.idf(docFreq, totalDocs);

      for (const { docIndex, termFreq } of postings) {
        const docLen = this.docLengths[docIndex];
        const tfNumerator = termFreq * (this.k1 + 1);
        const tfDenominator = termFreq + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        scores[docIndex] += termIdf * (tfNumerator / tfDenominator);
      }
    }

    // 收集得分大于 0 的文档
    const results: Array<{ item: MemoryItem; score: number }> = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > 0) {
        results.push({ item: this.documents[i], score: scores[i] });
      }
    }

    // 降序排序并截断 topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}
