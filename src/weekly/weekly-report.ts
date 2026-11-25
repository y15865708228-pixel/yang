import { App, Notice, normalizePath, TFile, TFolder } from "obsidian";
import type { ParaWavesSettings, WeeklyStats, SparkStatus, PenseaPlugin } from "../types";
import { scanSparks } from "../sparks/spark-engine";
import { getSRSData } from "../srs/review-scheduler";
import { isWikiFile } from "../wiki/wiki-path";

// 收集本周统计数据
export async function collectWeeklyStats(
  app: App,
  settings: ParaWavesSettings,
  plugin: PenseaPlugin
): Promise<WeeklyStats> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLabel = `W${getWeekNumber(now)}`;
  const todayStr = localDateStr(now);
  const weekAgoStr = localDateStr(weekAgo);

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
  for (const review of Object.values(srsData)) {
    if (review.lastReview >= weekAgoStr) reviewsCompleted++;
    if (review.nextReview <= todayStr) reviewsDue++;
  }

  // 5. Wiki 页面总数
  const wikiFiles = allFiles.filter((f) => isWikiFile(f.path, settings.wikiPath));
  const wikiPagesTotal = wikiFiles.length;

  // 6. Lint 问题数（从最近的 lint-report 读取）
  let lintIssues = 0;
  const lintPath = normalizePath(`${settings.wikiPath}/lint-report.md`);
  const lintFile = app.vault.getAbstractFileByPath(lintPath);
  if (lintFile && lintFile instanceof TFile) {
    const cache = app.metadataCache.getFileCache(lintFile);
    lintIssues = Number(cache?.frontmatter?.issues_count ?? 0);
  }

  // 7. 本周未完成任务
  const pendingTasks = await collectPendingTasks(app, settings, weekAgo, now);

  return {
    weekLabel: `${now.getFullYear()}-${weekLabel}`,
    newNotes,
    inboxRemaining,
    sparkTransitions,
    reviewsCompleted,
    reviewsDue,
    wikiPagesTotal,
    lintIssues,
    pendingTasks,
  };
}

// 生成本周回顾笔记
export async function generateWeeklyReport(
  app: App,
  settings: ParaWavesSettings,
  stats: WeeklyStats
): Promise<string> {
  const today = localDateStr(new Date());
  const fileName = `每周回顾 ${stats.weekLabel}`;
  const dailyPath = normalizePath(settings.dailyPath);
  const filePath = normalizePath(`${dailyPath}/${fileName}.md`);
  const lines = [
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
  ];

  // 未完成任务
  if (stats.pendingTasks.length > 0) {
    lines.push("## 未完成任务");
    lines.push("");
    for (const t of stats.pendingTasks) {
      lines.push(`- [ ] ${t.text}（[[${t.from}]]）`);
    }
    lines.push("");
  }

  const statistics = lines.join("\n").trimEnd();
  const digest = await statisticsDigest(statistics);
  const block = `<!-- pensea:weekly ${digest} -->\n${statistics}\n<!-- /pensea:weekly -->`;
  const freshReport = [
    "---", "type: 每周回顾", `week: "${stats.weekLabel}"`, `date: ${today}`,
    "tags:", "  - 周回顾", `created: ${today}`, "---",
    "", `# ${fileName}`, "", block, "",
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

  const { vault } = app;
  let report = vault.getAbstractFileByPath(filePath);
  if (!report) {
    if (!vault.getAbstractFileByPath(dailyPath)) {
      try {
        await vault.createFolder(dailyPath);
      } catch (error) {
        if (!(vault.getAbstractFileByPath(dailyPath) instanceof TFolder)) throw error;
      }
    }
    // 0.1.3 always generated in Daily, even when a different directory was configured.
    const legacy = dailyPath !== "Daily" ? vault.getAbstractFileByPath(`Daily/${fileName}.md`) : null;
    const initial = legacy instanceof TFile ? await vault.read(legacy) : freshReport;
    try {
      report = await vault.create(filePath, initial);
    } catch (error) {
      report = vault.getAbstractFileByPath(filePath);
      if (!(report instanceof TFile)) throw error;
    }
  }
  if (!(report instanceof TFile)) throw new Error(`周报路径已被目录占用：${filePath}`);

  const previous = await vault.read(report);
  // Only replace a previous block if it still matches the exact text generated by Pensea.
  // Unmarked 0.1.3 reports and user-edited blocks remain intact as historical snapshots.
  const last = lastStatisticsBlock(previous);
  if (last?.[0].replace(/\r\n/g, "\n") !== block) {
    const owned = last && await statisticsDigest(last[2]) === last[1] ? last[0] : null;
    await vault.process(report, current => {
      const latest = lastStatisticsBlock(current);
      if (latest?.[0].replace(/\r\n/g, "\n") === block) return current;
      if (latest && latest[0] === owned) {
        return current.slice(0, latest.index) + block + current.slice(latest.index! + owned.length);
      }
      return current + "\n\n" + block + "\n";
    });
  }

  new Notice(`周报已生成: ${fileName}`);
  return filePath;
}

function lastStatisticsBlock(text: string) {
  const matches = Array.from(text.matchAll(/^<!-- pensea:weekly ([a-f0-9]{64}) -->\r?\n([\s\S]*?)\r?\n<!-- \/pensea:weekly -->(?=\r?$)/gm));
  return matches[matches.length - 1];
}

async function statisticsDigest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.replace(/\r\n/g, "\n"));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

// 扫描本周日记中未完成的任务
async function collectPendingTasks(
  app: App,
  settings: ParaWavesSettings,
  weekAgo: Date,
  now: Date
): Promise<{ text: string; from: string }[]> {
  const folder = app.vault.getAbstractFileByPath(settings.dailyPath);
  if (!folder || !(folder instanceof TFolder)) return [];

  const weekAgoStr = localDateStr(weekAgo);
  const nowStr = localDateStr(now);
  const pending: { text: string; from: string }[] = [];

  for (const child of folder.children) {
    if (!(child instanceof TFile) || child.extension !== "md") continue;
    const dateName = child.name.replace(".md", "");
    if (dateName < weekAgoStr || dateName > nowStr) continue;

    const content = await app.vault.cachedRead(child);
    for (const line of content.split("\n")) {
      const match = line.match(/^- \[ \]\s*(.+)/);
      if (match) {
        pending.push({ text: match[1].trim(), from: dateName });
      }
    }
  }
  return pending;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
