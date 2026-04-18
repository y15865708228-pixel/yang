import { App, Notice, normalizePath, TFile } from "obsidian";
import type { ParaWavesSettings, LintIssue } from "../types";
import type { LLMProvider } from "../llm/provider";

const LINT_SYSTEM = `你是知识库的体检助手。检查以下 wiki 页面集合，找出问题。

请检查以下类型的问题：
1. **矛盾**: 不同页面间相互矛盾的声明
2. **孤儿页面**: 没有任何其他页面链接到的页面
3. **过时信息**: 可能已经过时的声明
4. **缺失链接**: 提到了某个概念但没有建立双链
5. **数据空白**: 重要主题缺少对应页面

用以下 JSON 数组格式回复（不要添加 markdown 代码块标记）：
[
  {
    "type": "contradiction|orphan|stale|missing-link|data-gap",
    "severity": "critical|warning|info",
    "page": "页面路径",
    "description": "问题描述",
    "suggestion": "修复建议"
  }
]

如果没发现问题，返回空数组 []`;

export async function lintWiki(
  app: App,
  settings: ParaWavesSettings,
  provider: LLMProvider
): Promise<LintIssue[]> {
  // 1. 收集所有 wiki 页面内容
  const wikiFiles = app.vault.getMarkdownFiles().filter((f) =>
    f.path.startsWith(settings.wikiPath)
  );

  if (wikiFiles.length === 0) {
    new Notice("Wiki 中没有页面可以检查");
    return [];
  }

  new Notice(`正在检查 ${wikiFiles.length} 个 wiki 页面...`);

  // 2. 分批收集（避免 token 超限，每批最多 20 页）
  const batchSize = 20;
  const allIssues: LintIssue[] = [];

  for (let i = 0; i < wikiFiles.length; i += batchSize) {
    const batch = wikiFiles.slice(i, i + batchSize);
    const pagesContent: string[] = [];

    for (const file of batch) {
      const content = await app.vault.cachedRead(file);
      pagesContent.push(`### ${file.path}\n${content.substring(0, 800)}`);
    }

    // 3. 调用 LLM 检查
    const reply = await provider.chat(
      [
        {
          role: "user",
          content: `请检查以下 wiki 页面：\n\n${pagesContent.join("\n\n")}`,
        },
      ],
      LINT_SYSTEM
    );

    // 4. 解析结果
    try {
      const jsonStr = reply.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const issues = JSON.parse(jsonStr);
      if (Array.isArray(issues)) {
        allIssues.push(...issues);
      }
    } catch {
      // LLM 回复格式异常，跳过这批
    }
  }

  // 5. 生成报告
  if (allIssues.length > 0) {
    await saveLintReport(app, settings, allIssues);
    new Notice(`Lint 完成：发现 ${allIssues.length} 个问题`);
  } else {
    new Notice("Lint 完成：未发现问题");
  }

  return allIssues;
}

async function saveLintReport(
  app: App,
  settings: ParaWavesSettings,
  issues: LintIssue[]
): Promise<void> {
  const reportPath = normalizePath(`${settings.wikiPath}/lint-report.md`);

  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    warning: "🟡",
    info: "🔵",
  };

  const typeLabel: Record<string, string> = {
    contradiction: "矛盾",
    orphan: "孤儿页面",
    stale: "过时信息",
    "missing-link": "缺失链接",
    "data-gap": "数据空白",
  };

  const lines = [
    "---",
    `type: lint-report`,
    `created: ${new Date().toISOString().slice(0, 10)}`,
    `issues_count: ${issues.length}`,
    "---",
    "",
    `# Wiki 体检报告`,
    "",
    `> 共发现 ${issues.length} 个问题`,
    "",
    "| 严重程度 | 类型 | 页面 | 问题 | 建议 |",
    "|---|---|---|---|---|",
    ...issues.map(
      (issue) =>
        `| ${severityEmoji[issue.severity] ?? ""} ${issue.severity} | ${typeLabel[issue.type] ?? issue.type} | [[${issue.page}]] | ${issue.description} | ${issue.suggestion} |`
    ),
    "",
  ];

  const content = lines.join("\n");

  const existing = app.vault.getAbstractFileByPath(reportPath);
  if (existing && existing instanceof TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(reportPath, content);
  }
}
