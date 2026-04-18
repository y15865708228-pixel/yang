import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { ParaWavesSettings, IngestResult } from "../types";
import type { LLMProvider } from "../llm/provider";

const SYSTEM_PROMPT = [
  "你是一个知识管理助手，使用 PARA 方法论分类笔记。",
  "",
  "分析笔记内容后返回 JSON（不要添加 markdown 代码块标记）：",
  "{",
  '  "summary": "200字以内摘要",',
  '  "para_type": "project | area | resource",',
  '  "para_category": "具体分类名（用2-4个字概括，如：健康、财务、摄影、装修客厅）",',
  '  "tags": ["标签1", "标签2"],',
  '  "relatedConcepts": ["概念1", "概念2"],',
  '  "wikiTitle": "wiki页面标题"',
  "}",
  "",
  "分类规则：",
  "- project：有明确目标和截止日期的事（如：装修客厅、备考PMP、组织聚会）",
  "- area：需要持续维护的责任领域（如：健康、财务、职业、家庭、房屋）",
  "- resource：感兴趣的参考素材（如：摄影技巧、编程笔记、读书笔记、方法论）",
  "",
  "注意：para_category 要简短通用，不要包含人名或公司名",
].join("\n");

export async function processInbox(
  app: App,
  settings: ParaWavesSettings,
  provider: LLMProvider
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  const inboxFolder = app.vault.getAbstractFileByPath(normalizePath(settings.inboxPath));
  if (!inboxFolder || !(inboxFolder instanceof TFolder)) {
    new Notice("Inbox 文件夹不存在");
    return results;
  }

  const files: TFile[] = [];
  for (const child of inboxFolder.children) {
    if (child instanceof TFile && child.extension === "md") {
      files.push(child);
    }
  }

  if (files.length === 0) {
    new Notice("Inbox 为空，没有需要处理的文件");
    return results;
  }

  new Notice(`正在处理 ${files.length} 个 Inbox 文件...`);

  for (const file of files) {
    try {
      const content = await app.vault.read(file);

      // 跳过 waves 自动生成的文件
      const cache = app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.created_by === "waves") continue;

      // 调用 LLM 分析
      const reply = await provider.chat(
        [{ role: "user", content: `请分析以下笔记内容：\n\n${content}` }],
        SYSTEM_PROMPT
      );

      let parsed: Record<string, unknown>;
      try {
        parsed = extractJSON(reply);
      } catch (e) {
        new Notice(`解析失败: ${file.basename} — ${e instanceof Error ? e.message : "JSON错误"}，跳过`);
        console.warn("ParaWaves ingest JSON parse error. Raw reply:", reply);
        continue;
      }

      const summary = String(parsed.summary ?? "");
      const paraType = String(parsed.para_type ?? "resource");
      const paraCategory = String(parsed.para_category ?? "未分类");
      const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [];
      const concepts = Array.isArray(parsed.relatedConcepts) ? parsed.relatedConcepts.map(String) : [];
      const wikiTitle = String(parsed.wikiTitle ?? file.basename);

      // 创建 wiki 摘要页
      const wikiPagesCreated: string[] = [];
      const wikiPath = normalizePath(`${settings.wikiPath}/${wikiTitle}.md`);
      if (!app.vault.getAbstractFileByPath(wikiPath)) {
        const wikiContent = [
          "---",
          "type: wiki-page",
          `title: "${wikiTitle}"`,
          `source: "${file.path}"`,
          `para_type: ${paraType}`,
          `para_category: "${paraCategory}"`,
          "tags:",
          ...tags.map((t: string) => `  - ${t}`),
          "related:",
          ...concepts.map((c: string) => `  - "[[${c}]]"`),
          "created_by: waves",
          `created: ${new Date().toISOString().slice(0, 10)}`,
          "---",
          "",
          `# ${wikiTitle}`,
          "",
          summary,
          "",
          "## 来源",
          "",
          `- [[${file.basename}]]`,
          "",
        ].join("\n");

        await app.vault.create(wikiPath, wikiContent);
        wikiPagesCreated.push(wikiPath);
      }

      // 更新 log.md
      await appendToLog(app, settings, "ingest", file.basename, summary);

      // 更新 index.md
      await updateIndex(app, settings, wikiTitle, wikiPath, paraCategory);

      // 归位原文件到 PARA 目录
      await archiveInboxFile(app, settings, file, paraType, paraCategory);

      results.push({
        sourcePath: file.path,
        summary,
        classification: { area: paraCategory, tags, relatedConcepts: concepts },
        wikiPagesCreated,
        wikiPagesUpdated: [],
      });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`ParaWaves ingest error for ${file.path}:`, msg);
      new Notice(`处理失败: ${file.basename} — ${msg.substring(0, 50)}`);
    }
  }

  new Notice(`Ingest 完成：处理了 ${results.length} 个文件`);
  return results;
}

async function appendToLog(
  app: App,
  settings: ParaWavesSettings,
  action: string,
  title: string,
  detail: string
): Promise<void> {
  const logPath = normalizePath(`${settings.wikiPath}/log.md`);
  const file = app.vault.getAbstractFileByPath(logPath);
  if (!file || !(file instanceof TFile)) return;

  const timestamp = new Date().toISOString().slice(0, 10);
  const entry = `\n## [${timestamp}] ${action} | ${title}\n\n${detail}\n`;
  await app.vault.append(file, entry);
}

async function updateIndex(
  app: App,
  settings: ParaWavesSettings,
  title: string,
  wikiPath: string,
  category: string
): Promise<void> {
  const indexPath = normalizePath(`${settings.wikiPath}/index.md`);
  const file = app.vault.getAbstractFileByPath(indexPath);
  if (!file || !(file instanceof TFile)) return;

  const entry = `- [[${title}]] — ${category}\n`;
  await app.vault.append(file, entry);
}

// 通用 PARA 归位：根据 LLM 返回的 para_type 和 para_category 决定目标目录
async function archiveInboxFile(
  app: App,
  settings: ParaWavesSettings,
  file: TFile,
  paraType: string,
  paraCategory: string
): Promise<void> {
  // 根据 para_type 选择顶层 PARA 目录
  let topDir: string;
  switch (paraType) {
    case "project":
      topDir = settings.projectsPath;   // 1-Projects
      break;
    case "area":
      topDir = settings.areasPath;       // 2-Areas
      break;
    case "resource":
      topDir = settings.resourcesPath;   // 3-Resources
      break;
    default:
      topDir = settings.archivePath;     // 4-Archive（兜底）
      break;
  }

  // para_category 作为子目录名
  const targetDir = normalizePath(`${topDir}/${paraCategory}`);

  // 确保目标目录存在
  if (!app.vault.getAbstractFileByPath(targetDir)) {
    await app.vault.createFolder(targetDir);
  }

  // 移动文件
  const newPath = normalizePath(`${targetDir}/${file.name}`);
  if (!app.vault.getAbstractFileByPath(newPath)) {
    await app.fileManager.renameFile(file, newPath);
  }
}

function extractJSON(text: string): Record<string, unknown> {
  // 策略1: 找 ```json ... ``` 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // 策略2: 找 { ... } 最外层花括号
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    const candidate = text.substring(braceStart, braceEnd + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // fall through
    }
  }

  // 策略3: 直接当 JSON 解析
  return JSON.parse(text.trim());
}
