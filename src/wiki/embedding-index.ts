import { App, Notice, normalizePath, TFile } from "obsidian";
import type { ParaWavesSettings, PenseaPlugin } from "../types";
import type { LLMProvider } from "../llm/provider";

// 单条 embedding 记录
export interface EmbeddingEntry {
  vector: number[];
  title: string;
  updated: string; // 文件最后修改日期
}

// 整个索引
export type EmbeddingIndex = Record<string, EmbeddingEntry>;

// 余弦相似度
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// 从 plugin data 读取索引
export async function getEmbeddingIndex(plugin: PenseaPlugin): Promise<EmbeddingIndex> {
  const data = await plugin.loadData();
  return (data?.embeddingIndex ?? {}) as EmbeddingIndex;
}

// 保存索引到 plugin data
async function saveEmbeddingIndex(plugin: PenseaPlugin, index: EmbeddingIndex): Promise<void> {
  const data = await plugin.loadData();
  data.embeddingIndex = index;
  await plugin.saveData(data);
}

// 获取单个 wiki 页面的文本摘要（用于 embedding）
async function getPageText(app: App, file: TFile): Promise<string> {
  const content = await app.vault.cachedRead(file);
  // 去掉 frontmatter，取前 800 字
  const body = content.replace(/^---[\s\S]*?---\n*/, "");
  return body.substring(0, 800).trim();
}

// 全量构建索引
export async function buildEmbeddingIndex(
  app: App,
  settings: ParaWavesSettings,
  provider: LLMProvider,
  plugin: PenseaPlugin,
): Promise<number> {
  const indexPath = normalizePath(`${settings.wikiPath}/index.md`);
  const allWikiFiles = app.vault.getMarkdownFiles().filter(
    (f) => f.path.startsWith(settings.wikiPath) && f.path !== indexPath
  );

  if (allWikiFiles.length === 0) {
    new Notice("Wiki 中没有页面可以索引");
    return 0;
  }

  new Notice(`正在构建 embedding 索引 (${allWikiFiles.length} 页)...`);

  const index: EmbeddingIndex = {};

  // 分批处理，每批 10 个（避免 API 限制）
  const batchSize = 10;
  for (let i = 0; i < allWikiFiles.length; i += batchSize) {
    const batch = allWikiFiles.slice(i, i + batchSize);

    // 收集文本
    const texts: string[] = [];
    for (const file of batch) {
      const text = await getPageText(app, file);
      texts.push(text || file.basename);
    }

    // 调用 embedding API
    const vectors = await provider.embed(texts);

    // 存入索引
    for (let j = 0; j < batch.length; j++) {
      const file = batch[j];
      const cache = app.metadataCache.getFileCache(file);
      const title = cache?.frontmatter?.title ?? file.basename;
      index[file.path] = {
        vector: vectors[j],
        title: String(title),
        updated: localDateStr(new Date(file.stat.mtime)),
      };
    }
  }

  await saveEmbeddingIndex(plugin, index);
  new Notice(`索引构建完成：${allWikiFiles.length} 页`);
  return allWikiFiles.length;
}

// 增量更新：只处理新增/变更的页面
export async function updateEmbeddingIndex(
  app: App,
  settings: ParaWavesSettings,
  provider: LLMProvider,
  plugin: PenseaPlugin,
): Promise<number> {
  const existingIndex = await getEmbeddingIndex(plugin);
  const indexPath = normalizePath(`${settings.wikiPath}/index.md`);
  const allWikiFiles = app.vault.getMarkdownFiles().filter(
    (f) => f.path.startsWith(settings.wikiPath) && f.path !== indexPath
  );

  // 找出需要更新的页面
  const toUpdate: TFile[] = [];
  for (const file of allWikiFiles) {
    const existing = existingIndex[file.path];
    const modifiedDate = localDateStr(new Date(file.stat.mtime));
    if (!existing || existing.updated !== modifiedDate) {
      toUpdate.push(file);
    }
  }

  // 删除已不存在的页面
  const wikiPaths = new Set(allWikiFiles.map((f) => f.path));
  let removed = 0;
  for (const path of Object.keys(existingIndex)) {
    if (!wikiPaths.has(path)) {
      delete existingIndex[path];
      removed++;
    }
  }

  if (toUpdate.length === 0 && removed === 0) return 0;

  // 分批 embedding
  const batchSize = 10;
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    const texts: string[] = [];
    for (const file of batch) {
      const text = await getPageText(app, file);
      texts.push(text || file.basename);
    }
    const vectors = await provider.embed(texts);
    for (let j = 0; j < batch.length; j++) {
      const file = batch[j];
      const cache = app.metadataCache.getFileCache(file);
      const title = cache?.frontmatter?.title ?? file.basename;
      existingIndex[file.path] = {
        vector: vectors[j],
        title: String(title),
        updated: localDateStr(new Date(file.stat.mtime)),
      };
    }
  }

  await saveEmbeddingIndex(plugin, existingIndex);
  return toUpdate.length;
}

// 语义搜索：返回最相关的 K 个页面路径
export async function semanticSearch(
  query: string,
  provider: LLMProvider,
  plugin: PenseaPlugin,
  topK = 8,
): Promise<{ path: string; title: string; score: number }[]> {
  const index = await getEmbeddingIndex(plugin);
  const entries = Object.entries(index);

  if (entries.length === 0) return [];

  // 查询文本 → 向量
  const [queryVec] = await provider.embed([query]);

  // 计算相似度并排序
  const scored = entries.map(([path, entry]) => ({
    path,
    title: entry.title,
    score: cosineSimilarity(queryVec, entry.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
