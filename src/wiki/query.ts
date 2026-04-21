import { App, Notice, normalizePath, TFile } from "obsidian";
import type { ParaWavesSettings } from "../types";
import type { LLMProvider } from "../llm/provider";
import { semanticSearch, getEmbeddingIndex } from "./embedding-index";

const QUERY_SYSTEM = `你是 Pensea 知识库的问答助手。请基于提供的 wiki 内容回答问题。
规则：
1. 回答必须基于提供的 wiki 内容，不要编造
2. 在回答中使用 [[双链]] 引用相关的 wiki 页面
3. 如果信息不足，明确说明
4. 用中文回答`;

export async function queryWiki(
  app: App,
  settings: ParaWavesSettings,
  provider: LLMProvider,
  question: string,
  plugin?: any,
): Promise<string> {
  // 1. 读取 index.md
  const indexPath = normalizePath(`${settings.wikiPath}/index.md`);
  const indexFile = app.vault.getAbstractFileByPath(indexPath);
  let indexContent = "";
  if (indexFile && indexFile instanceof TFile) {
    indexContent = await app.vault.read(indexFile);
  }

  // 2. 选择搜索策略：优先 embedding 语义搜索，回退关键词匹配
  let relevantPages: { title: string; path: string; content: string }[] = [];

  // 尝试语义搜索
  let usedSemantic = false;
  if (plugin) {
    try {
      const embIndex = await getEmbeddingIndex(plugin);
      const entryCount = Object.keys(embIndex).length;

      if (entryCount > 0) {
        const results = await semanticSearch(question, provider, plugin, 8);
        const threshold = 0.3; // 最低相似度阈值

        for (const result of results) {
          if (result.score < threshold) continue;
          const file = app.vault.getAbstractFileByPath(result.path);
          if (file && file instanceof TFile) {
            const content = await app.vault.cachedRead(file);
            relevantPages.push({
              title: result.title,
              path: result.path,
              content: content.substring(0, 600),
            });
          }
        }
        usedSemantic = relevantPages.length > 0;
      }
    } catch (e) {
      console.warn("ParaWaves semantic search failed, falling back to keywords:", e);
    }
  }

  // 回退：关键词匹配
  if (!usedSemantic) {
    relevantPages = await keywordSearch(app, settings, question, indexPath);
  }

  // 3. 构建上下文
  const context = relevantPages
    .map((p) => `## ${p.title}\n${p.content}`)
    .join("\n\n");

  const searchMethod = usedSemantic ? "（语义搜索）" : "（关键词匹配）";
  const fullContext = context
    ? `## Wiki 索引\n${indexContent.substring(0, 1000)}\n\n## 相关页面 ${searchMethod}\n${context}`
    : "Wiki 中暂无内容。";

  // 4. 调用 LLM
  const reply = await provider.chat(
    [
      { role: "user", content: `知识库内容：\n${fullContext}\n\n我的问题：${question}` },
    ],
    QUERY_SYSTEM
  );

  return reply;
}

// 关键词搜索（回退方案）
async function keywordSearch(
  app: App,
  settings: ParaWavesSettings,
  question: string,
  indexPath: string,
): Promise<{ title: string; path: string; content: string }[]> {
  const keywords = question.split(/\s+/).filter((w) => w.length > 1);
  const wikiFolder = app.vault.getAbstractFileByPath(normalizePath(settings.wikiPath));
  const pages: { title: string; path: string; content: string }[] = [];

  if (!wikiFolder) return pages;

  const allWikiFiles = app.vault.getMarkdownFiles().filter(
    (f) => f.path.startsWith(settings.wikiPath) && f.path !== indexPath
  );

  for (const file of allWikiFiles) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const tags = fm?.tags ?? [];
    const title = fm?.title ?? file.basename;
    const area = fm?.area ?? "";

    const searchText = `${title} ${tags.join(" ")} ${area} ${file.basename}`.toLowerCase();
    const matched = keywords.some((k) => searchText.includes(k.toLowerCase()));

    if (matched || allWikiFiles.length <= 20) {
      const content = await app.vault.cachedRead(file);
      pages.push({
        title,
        path: file.path,
        content: content.substring(0, 500),
      });
    }
    if (pages.length >= 10) break;
  }

  return pages;
}

// 保存问答结果为新的 wiki 页面
export async function saveQueryAsWiki(
  app: App,
  settings: ParaWavesSettings,
  question: string,
  answer: string
): Promise<string> {
  const title = `Q: ${question.substring(0, 40)}`;
  const safeName = title.replace(/[/\\?%*:|"<>]/g, "-");
  const path = normalizePath(`${settings.wikiPath}/${safeName}.md`);

  const content = [
    "---",
    `type: wiki-page`,
    `title: "${title}"`,
    `source: "query"`,
    `created_by: waves`,
    `created: ${new Date().toISOString().slice(0, 10)}`,
    "---",
    "",
    `# ${title}`,
    "",
    answer,
    "",
  ].join("\n");

  if (!app.vault.getAbstractFileByPath(path)) {
    await app.vault.create(path, content);
    return path;
  }
  return "";
}
