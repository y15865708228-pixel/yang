const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { compileFunction } = require("node:vm");
const { buildSync } = require("esbuild");

class TFolder { children = []; }
class TFile {
  constructor(filePath, content) {
    this.path = filePath;
    this.name = path.posix.basename(filePath);
    this.basename = this.name.slice(0, -3);
    this.content = content;
  }
}
const { outputFiles } = buildSync({
  stdin: {
    resolveDir: path.join(__dirname, ".."),
    contents: 'export * from "./src/daily/monthly-archiver"; export * from "./src/weekly/weekly-report";',
  },
  write: false, bundle: true, format: "cjs", platform: "node", external: ["obsidian"],
});
const entry = { exports: {} };
compileFunction(outputFiles[0].text, ["module", "exports", "require"])(
  entry, entry.exports, () => ({ TFile, TFolder, Notice: class {}, normalizePath: path.posix.normalize }),
);
const { archiveMonthlyDaily, generateWeeklyReport } = entry.exports;

function openVault() {
  const items = new Map();
  const vault = {
    getAbstractFileByPath: key => items.get(key) ?? null,
    async createFolder(key) {
      const folder = new TFolder();
      items.set(key, folder);
      return folder;
    },
    async create(key, content) {
      if (items.has(key)) throw new Error("File exists");
      const file = new TFile(key, content);
      items.set(key, file);
      items.get(path.posix.dirname(key)).children.push(file);
      return file;
    },
    async read(file) { return file.content; },
    async process(file, update) { return file.content = update(file.content); },
  };
  return { vault };
}

test("monthly archive retains original journals, legacy summaries and late edits across reruns", async () => {
  const app = openVault();
  const { vault } = app;
  const settings = { dailyPath: "Journal", archivePath: "History" };
  const now = new Date();
  const priorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${priorMonth.getFullYear()}-${String(priorMonth.getMonth() + 1).padStart(2, "0")}`;
  await vault.createFolder("Journal");
  await vault.createFolder("History/Daily");
  const original = "---\r\ntype: 日记\r\n---\r\n\r\n## Log\r\n原始记录\r\n## 自定义\r\n![[附件.png]]\r\n";
  const first = await vault.create(`Journal/${month}-01.md`, original);
  await vault.create(`Journal/${month}-会议纪要.md`, "不是日记");
  await vault.create(`Journal/${month}-32.md`, "非法日期");
  const oldSummary = "---\r\ntotal_tasks: 88\r\ndone_tasks: 81\r\npending_tasks: 7\r\n---\r\n# 历史月报\r\n作者补注，原样保留。\r\n";
  const summary = await vault.create(`History/Daily/${month}.md`, oldSummary);
  await archiveMonthlyDaily(app, settings);
  const firstArchive = summary.content;
  assert.ok(firstArchive.startsWith(oldSummary));
  assert.ok(firstArchive.includes(original));
  assert.doesNotMatch(firstArchive, /不是日记|非法日期/);
  assert.equal(first.content, original);
  await archiveMonthlyDaily(app, settings);
  assert.equal(summary.content, firstArchive);

  const second = await vault.create(`Journal/${month}-02.md`, "## Log\n补写第二天\n- [ ] 跟进");
  first.content += "\r\n第一天新增内容";
  await archiveMonthlyDaily(app, settings);
  assert.ok(summary.content.startsWith(firstArchive));
  assert.ok(summary.content.includes(first.content));
  assert.ok(summary.content.includes(second.content));
  const afterLateEntry = summary.content;
  await archiveMonthlyDaily(app, settings);
  assert.equal(summary.content, afterLateEntry);
});

test("monthly tasks count each current source once and protect edited or incomplete historical totals", async () => {
  const app = openVault();
  const { vault } = app;
  const settings = { dailyPath: "Journal", archivePath: "History" };
  const now = new Date();
  const priorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${priorMonth.getFullYear()}-${String(priorMonth.getMonth() + 1).padStart(2, "0")}`;
  const folder = await vault.createFolder("Journal");
  const first = await vault.create(`Journal/${month}-01.md`, "- [x] 一\n- [ ] 二");
  await archiveMonthlyDaily(app, settings);
  const report = vault.getAbstractFileByPath(`History/Daily/${month}.md`);
  assert.match(report.content, /total_tasks: 2\ndone_tasks: 1\npending_tasks: 1/);
  assert.match(report.content, /完成 1\/2 项任务（50%）/);

  first.content = "- [x] 一\n- [x] 二";
  const second = await vault.create(`Journal/${month}-02.md`, "- [ ] 三");
  await archiveMonthlyDaily(app, settings);
  assert.match(report.content, /total_tasks: 3\ndone_tasks: 2\npending_tasks: 1/);
  assert.match(report.content, /完成 2\/3 项任务（67%）/);
  const updated = report.content;
  await archiveMonthlyDaily(app, settings);
  assert.equal(report.content, updated);

  folder.children = [second];
  second.content += "\n- [ ] 四";
  await archiveMonthlyDaily(app, settings);
  assert.match(report.content, /total_tasks: 3\ndone_tasks: 2\npending_tasks: 1/);
  folder.children.push(first);
  report.content = report.content.replace("done_tasks: 2", "done_tasks: 20 # 手工核对");
  await archiveMonthlyDaily(app, settings);
  assert.match(report.content, /done_tasks: 20 # 手工核对/);
  assert.match(report.content, /完成 2\/3 项任务（67%）/);
});

test("weekly updates preserve the legacy report, handwritten sections and edits inside statistics", async () => {
  const app = openVault();
  const { vault } = app;
  await vault.createFolder("Daily");
  const oldContent = "---\r\ntype: 每周回顾\r\n---\r\n## 本周完成\r\n已签合同\r\n## 下周计划\r\n周三寄样\r\n";
  const prior = await vault.create("Daily/每周回顾 2026-W8.md", oldContent);
  const settings = { dailyPath: "Journal" };
  const stats = {
    weekLabel: "2026-W8", newNotes: 8, inboxRemaining: 2, wikiPagesTotal: 0, lintIssues: 0,
    reviewsCompleted: 1, reviewsDue: 0, sparkTransitions: {}, pendingTasks: [],
  };
  const filePath = await generateWeeklyReport(app, settings, stats);
  assert.equal(filePath, "Journal/每周回顾 2026-W8.md");
  const report = vault.getAbstractFileByPath(filePath);
  assert.ok(report.content.startsWith(oldContent));
  assert.equal(prior.content, oldContent);
  const snapshot = report.content;
  await generateWeeklyReport(app, settings, stats);
  assert.equal(report.content, snapshot);

  report.content += "\n## 自己的批注\n保留新文字\n";
  stats.newNotes = 9;
  await generateWeeklyReport(app, settings, stats);
  assert.ok(report.content.startsWith(oldContent));
  assert.ok(report.content.includes("保留新文字"));
  assert.ok(report.content.includes("| 新建笔记 | 9 |"));
  assert.equal(report.content.split("<!-- pensea:weekly ").length - 1, 1);

  report.content = report.content.replace("| Inbox 剩余 | 2 |", "| Inbox 剩余 | 2 | 已手动核对");
  stats.newNotes = 10;
  const edited = report.content;
  await generateWeeklyReport(app, settings, stats);
  assert.ok(report.content.startsWith(edited));
  assert.ok(report.content.includes("| 新建笔记 | 10 |"));
  const regenerated = report.content;
  await generateWeeklyReport(app, settings, stats);
  assert.equal(report.content, regenerated);
});
