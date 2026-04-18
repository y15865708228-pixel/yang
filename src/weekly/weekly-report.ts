import { App, Notice, normalizePath, TFile } from "obsidian";
import type { ParaWavesSettings, WeeklyStats, SparkStatus } from "../types";
import { scanSparks } from "../sparks/spark-engine";
import { getSRSData } from "../srs/review-scheduler";

// 收集本周统计数据
export async function collectWeeklyStats(
  app: App,
  settings: ParaWavesSettings,
  plugin: { loadData: () => Promise<Record<string, unknown>> }
): Promise<WeeklyStats> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLabel = `W${getWeekNumber(now)}`;

  // 1. 新建笔记数
  const allFiles = app.vault.getMarkdownFiles();
  const newNotes = allFiles.filter((f) => {
    return f.stat.ctime >= weekAgo.getTime();
  }).length;

  // 2. Inbox 剩余
  const inboxPath = normalizePath(settings.inboxPath);
  const inboxFolder = app.vault.getAbstractFileByPath(inboxPath);
  let inboxRemaining = 0;
  if (inboxFolder) {
    for (const child of (inboxFolder as any).children ?? []) {
      if (child instanceof TFile && child.extension === "md") inboxRemaining++;
    }
  }

  // 3. Sparks 统计
  const sparks = await scanSparks(app, settings);
  const sparkTransitions: Record<SparkStatus, number> = {
    "🫧待孵化": 0,
    "🔥孵化中": 0,
    "✅准备好": 0,
    "❌已放弃": 0,
  };
  for (const s of sparks) {
    sparkTransitions[s.status]++;
  }

  // 4. 复习统计
  const srsData = await getSRSData(plugin);
  let reviewsCompleted = 0;
  let reviewsDue = 0;
  const today = now.toISOString().slice(0, 10);
  for (const review of Object.values(srsData)) {
    if (review.lastReview >= weekAgo.toISOString().slice(0, 10)) reviewsCompleted++;
    if (review.nextReview <= today) reviewsDue++;
  }

  // 5. Wiki 页面总数
  const wikiFiles = allFiles.filter((f) => f.path.startsWith(settings.wikiPath));
  const wikiPagesTotal = wikiFiles.length;

  // 6. Lint 问题数（从最近的 lint-report 读取）
  let lintIssues = 0;
  const lintPath = normalizePath(`${settings.wikiPath}/lint-report.md`);
  const lintFile = app.vault.getAbstractFileByPath(lintPath);
  if (lintFile && lintFile instanceof TFile) {
    const cache = app.metadataCache.getFileCache(lintFile);
    lintIssues = Number(cache?.frontmatter?.issues_count ?? 0);
  }

  return {
    weekLabel: `${now.getFullYear()}-${weekLabel}`,
    newNotes,
    inboxRemaining,
    sparkTransitions,
    reviewsCompleted,
    reviewsDue,
    wikiPagesTotal,
    lintIssues,
  };
}

// 生成本周回顾笔记
export async function generateWeeklyReport(
  app: App,
  settings: ParaWavesSettings,
  stats: WeeklyStats
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `每周回顾 ${stats.weekLabel}`;
  const filePath = normalizePath(`Daily/${fileName}.md`);

  const content = [
    "---",
    `type: 每周回顾`,
    `week: "${stats.weekLabel}"`,
    `date: ${today}`,
    `tags:`,
    `  - 周回顾`,
    `created: ${today}`,
    "---",
    "",
    `# 每周回顾 ${stats.weekLabel}`,
    "",
    "## 本周概览",
    "",
    "| 指标 | 数值 |",
    "|---|---|",
    `| 新建笔记 | ${stats.newNotes} |`,
    `| Inbox 剩余 | ${stats.inboxRemaining} |`,
    `| Wiki 页面总数 | ${stats.wikiPagesTotal} |`,
    `| 复习完成 | ${stats.reviewsCompleted} |`,
    `| 待复习 | ${stats.reviewsDue} |`,
    `| Lint 问题 | ${stats.lintIssues} |`,
    "",
    "## Sparks 灵感池",
    "",
    "| 状态 | 数量 |",
    "|---|---|",
    ...Object.entries(stats.sparkTransitions).map(
      ([status, count]) => `| ${status} | ${count} |`
    ),
    "",
    "## 本周完成",
    "",
    "> 手动补充",
    "",
    "## 下周计划",
    "",
    "1. ",
    "2. ",
    "3. ",
    "",
  ].join("\n");

  // 检查文件是否已存在
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing && existing instanceof TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }

  new Notice(`周报已生成: ${fileName}`);
  return filePath;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
