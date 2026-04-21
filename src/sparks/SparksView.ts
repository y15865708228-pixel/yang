import { ItemView, WorkspaceLeaf, Menu, Notice, TFile, normalizePath, MarkdownView } from "obsidian";
import type { Spark, SparkStatus, ParaWavesSettings } from "../types";
import { scanSparks, isStale, updateSparkStatus } from "./spark-engine";
import { processInbox } from "../wiki/ingest";
import { lintWiki } from "../wiki/lint";
import { collectWeeklyStats, generateWeeklyReport } from "../weekly/weekly-report";
import { getSRSData, buildReviewQueue } from "../srs/review-scheduler";
import { ReviewModal } from "../srs/review-modal";
import type { LLMProvider } from "../llm/provider";
import { formatNote, continueWriting } from "../editor/writing-assist";
import { solarToLunar } from "../utils/lunar";
import { getDailyMotivation } from "../utils/iching";
import { iconHTML } from "../utils/icons";

export const SPARKS_VIEW_TYPE = "para-waves-sparks";

const STATUS_COLUMNS: { status: SparkStatus; icon: string; label: string }[] = [
  { status: "🫧待孵化", icon: "🫧", label: "待孵化" },
  { status: "🔥孵化中", icon: "🔥", label: "孵化中" },
  { status: "✅准备好", icon: "✅", label: "准备好" },
  { status: "❌已放弃", icon: "❌", label: "已放弃" },
];


type StatusType = "running" | "done" | "error";

export class SparksView extends ItemView {
  private settings: ParaWavesSettings;
  private plugin: any;
  private sparks: Spark[] = [];
  private inboxCount = 0;
  private dueReviews = 0;
  private wikiTotal = 0;
  private dragSrcPath: string | null = null;
  private statusEl: HTMLElement | null = null;
  private statusText = "";
  private statusType: StatusType = "running";
  private busy = false;

  constructor(leaf: WorkspaceLeaf, settings: ParaWavesSettings, plugin: any) {
    super(leaf);
    this.settings = settings;
    this.plugin = plugin;
  }

  getViewType(): string { return SPARKS_VIEW_TYPE; }
  getDisplayText(): string { return "ParaWaves"; }
  getIcon(): string { return "sparkles"; }

  async onOpen() {
    await this.refresh();
    this.registerEvent(this.app.vault.on("modify", () => this.debouncedRefresh()));
    this.registerEvent(this.app.vault.on("create", () => this.debouncedRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.debouncedRefresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.debouncedRefresh()));
  }

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private debouncedRefresh() {
    if (this.busy) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), 500);
  }

  async refresh() {
    this.sparks = await scanSparks(this.app, this.settings);
    const inboxFolder = this.app.vault.getAbstractFileByPath(this.settings.inboxPath);
    this.inboxCount = 0;
    if (inboxFolder && (inboxFolder as any).children) {
      for (const c of (inboxFolder as any).children) {
        if (c.extension === "md") this.inboxCount++;
      }
    }
    try {
      const srsData = await getSRSData(this.plugin);
      const queue = await buildReviewQueue(this.app, this.settings, srsData);
      this.dueReviews = queue.length;
    } catch { this.dueReviews = 0; }
    this.wikiTotal = this.app.vault.getMarkdownFiles().filter(
      (f) => f.path.startsWith(this.settings.wikiPath)
    ).length;
    this.render();
  }

  private get provider(): LLMProvider | null {
    return this.plugin.llmProvider;
  }

  // ─── 状态栏 ───

  private setStatus(text: string, type: StatusType = "running") {
    this.statusText = text;
    this.statusType = type;
    this.applyStatus();
  }

  private clearStatus() {
    this.statusText = "";
    if (this.statusEl) this.statusEl.style.display = "none";
  }

  private applyStatus() {
    if (!this.statusEl) return;
    if (!this.statusText) { this.statusEl.style.display = "none"; return; }
    this.statusEl.textContent = this.statusText;
    this.statusEl.className = "pw-status-bar";
    if (this.statusType === "done") this.statusEl.addClass("pw-status-done");
    if (this.statusType === "error") this.statusEl.addClass("pw-status-error");
    this.statusEl.style.display = "block";
  }

  // ─── 渲染 ───

  private render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("pw-dashboard");

    // 状态栏
    this.statusEl = el.createDiv({ cls: "pw-status-bar" });
    this.applyStatus();

    // 统计卡片
    const stats = el.createDiv({ cls: "pw-stats-row" });
    this.stat(stats, "pw-inbox", this.inboxCount, "Inbox");
    this.stat(stats, "pw-spark", this.sparks.length, "Sparks");
    this.stat(stats, "pw-review", this.dueReviews, "待复习");
    this.stat(stats, "pw-wiki", this.wikiTotal, "Wiki");

    // 快捷操作
    const actions = el.createDiv({ cls: "pw-quick-actions" });
    this.actionBtn(actions, "pw-ingest", "处理 Inbox", () => this.doIngest());
    this.actionBtn(actions, "pw-cards", "复习卡片", () => this.doReview());
    this.actionBtn(actions, "pw-health", "健康检查", () => this.doLint());
    this.actionBtn(actions, "pw-chart", "周报", () => this.doWeekly());
    this.actionBtn(actions, "pw-format", "整理排版", () => this.doFormat());
    this.actionBtn(actions, "pw-pen", "继续写", () => this.doContinue());

    // 过期提醒
    const staleSparks = this.sparks.filter((s) => isStale(s, this.settings) !== "none");
    if (staleSparks.length > 0) {
      const alertSection = el.createDiv({ cls: "pw-stale-alert" });
      const alertHeader = alertSection.createDiv({ cls: "pw-stale-alert-header" });
      alertHeader.innerHTML = `${iconHTML("pw-health", 14)} ${staleSparks.length} 个灵感需要处理`;
      for (const spark of staleSparks) {
        const row = alertSection.createDiv({ cls: "pw-stale-item" });
        const stale = isStale(spark, this.settings);
        const dot = `<span class="pw-stale-dot ${stale === "hatch" ? "pw-stale-red" : "pw-stale-orange"}"></span>`;
        row.innerHTML = `${dot} ${spark.title || spark.filePath.split("/").pop()} · ${spark.staleDays}天`;
        row.addEventListener("click", () =>
          this.app.workspace.openLinkText(spark.filePath, "", false)
        );
      }
    }

    // ─── Sparks 看板 ───
    this.renderSparksBoard(el);

    // ─── 今日概览（固定底部）───
    this.renderDailyOverview(el);

    // ─── 每日宣言 ───
    this.renderMotivation(el);
  }

  // ─── 今日概览（月历卡片）───

  private async renderDailyOverview(parent: HTMLElement) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const todayDate = now.getDate();
    const todayStr = localDateStr(now);
    const lunar = solarToLunar(year, month + 1, todayDate);

    const section = parent.createDiv({ cls: "pw-daily-section" });

    // ─── 头部：月份 · 年份 | 农历年 ───
    const header = section.createDiv({ cls: "pw-daily-header" });
    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    header.createSpan({ cls: "pw-daily-month", text: `${monthNames[month]} ${year}` });
    header.createSpan({ cls: "pw-daily-lunar", text: `${lunar.ganZhi}${lunar.shengXiao}年` });

    // ─── 今日 ───
    const todayRow = section.createDiv({ cls: "pw-daily-today-row" });
    todayRow.createDiv({ cls: "pw-daily-today-num", text: String(todayDate) });
    const todayInfo = todayRow.createDiv({ cls: "pw-daily-today-info" });
    const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
    todayInfo.createDiv({ cls: "pw-daily-today-weekday", text: weekday });
    todayInfo.createDiv({ cls: "pw-daily-today-lunar", text: `${lunar.monthStr}${lunar.dayStr}` });

    // ─── 月历网格 ───
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dailyFiles = new Set<string>();
    const folder = this.app.vault.getAbstractFileByPath(this.settings.dailyPath);
    if (folder && (folder as any).children) {
      for (const c of (folder as any).children) {
        if (c.extension === "md" && c.name.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) {
          dailyFiles.add(c.name.replace(".md", ""));
        }
      }
    }

    // 星期头
    const calHeader = section.createDiv({ cls: "pw-cal-header" });
    for (const w of ["日", "一", "二", "三", "四", "五", "六"]) {
      calHeader.createDiv({ cls: "pw-cal-weekday", text: w });
    }

    const grid = section.createDiv({ cls: "pw-cal-grid" });

    // 前置空格
    for (let i = 0; i < firstDay; i++) {
      grid.createDiv({ cls: "pw-cal-cell pw-cal-empty" });
    }

    // 日期格子
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = d === todayDate;
      const hasNote = dailyFiles.has(ds);

      const cell = grid.createDiv({ cls: "pw-cal-cell" });
      if (isToday) cell.addClass("pw-cal-today");
      if (hasNote) cell.addClass("pw-cal-has-note");

      cell.createDiv({ cls: "pw-cal-num", text: String(d) });
      if (hasNote && !isToday) cell.createDiv({ cls: "pw-cal-dot" });

      const dailyPath = normalizePath(`${this.settings.dailyPath}/${ds}.md`);
      cell.addEventListener("click", () => {
        const file = this.app.vault.getAbstractFileByPath(dailyPath);
        if (file && file instanceof TFile) {
          this.app.workspace.openLinkText(dailyPath, "", false);
        } else {
          this.createDailyNote(dailyPath, ds);
        }
      });
    }

    // ─── 今日任务 ───
    const dailyPath = normalizePath(`${this.settings.dailyPath}/${todayStr}.md`);
    const dailyFile = this.app.vault.getAbstractFileByPath(dailyPath);

    if (dailyFile && dailyFile instanceof TFile) {
      const content = await this.app.vault.cachedRead(dailyFile);
      const tasks = this.extractTasks(content);
      if (tasks.length > 0) {
        const done = tasks.filter((t) => t.done).length;

        const taskHeader = section.createDiv({ cls: "pw-daily-task-header" });
        taskHeader.createSpan({ text: "今日任务" });
        const pct = Math.round((done / tasks.length) * 100);
        taskHeader.createSpan({ cls: "pw-daily-task-pct", text: `${done}/${tasks.length}` });

        const progressBar = section.createDiv({ cls: "pw-daily-progress-bar" });
        progressBar.createDiv({ cls: "pw-daily-progress-fill" }).style.width = `${pct}%`;

        const taskList = section.createDiv({ cls: "pw-daily-tasks" });
        const pending = tasks.filter((t) => !t.done).slice(0, 5);
        for (const task of pending) {
          const row = taskList.createDiv({ cls: "pw-daily-task" });
          row.textContent = `☐ ${task.text}`;
          row.addEventListener("click", () => {
            this.app.workspace.openLinkText(dailyPath, "", false);
          });
        }
        if (pending.length === 0 && done > 0) {
          taskList.createDiv({ cls: "pw-daily-task pw-daily-task-all-done", text: "今日任务已全部完成" });
        }
      }
    }
  }

  private async createDailyNote(path: string, ds: string) {
    this.busy = true; // Block kanban refresh during creation
    try {
      const template = await this.plugin.generateDailyTemplate(ds);
      await this.app.vault.create(path, template);
      await this.app.workspace.openLinkText(path, "", false);
    } catch (e) {
      new Notice(`创建日记失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  // ─── Sparks 看板（紧凑列表）───

  private renderSparksBoard(parent: HTMLElement) {
    const section = parent.createDiv({ cls: "pw-section" });
    const header = section.createDiv({ cls: "pw-section-header" });
    header.innerHTML = `${iconHTML("pw-spark", 14)} Sparks`;

    // 快速输入
    const inputRow = section.createDiv({ cls: "pw-sparks-input" });
    const input = inputRow.createEl("input", {
      type: "text",
      placeholder: "记一个灵感...",
      cls: "pw-sparks-input-field",
    });
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        await this.createSpark(text);
      }
    });

    const hint = section.createDiv({ cls: "pw-sparks-hint" });
    hint.textContent = "回车创建 · 点击名称打开 · 点 → 流转 · 右键全部选项";

    const list = section.createDiv({ cls: "pw-sparks-list" });

    for (const col of STATUS_COLUMNS) {
      const colSparks = this.sparks.filter((s) => s.status === col.status);
      if (colSparks.length === 0) continue;

      // 分组标签
      const statusGroupCls: Record<string, string> = {
        "🫧待孵化": "pw-group-hatch",
        "🔥孵化中": "pw-group-incubate",
        "✅准备好": "pw-group-ready",
        "❌已放弃": "pw-group-abandon",
      };
      const statusIcons: Record<string, string> = {
        "🫧待孵化": "pw-hatch",
        "🔥孵化中": "pw-fire",
        "✅准备好": "pw-check",
        "❌已放弃": "pw-x",
      };
      const statusRowCls: Record<string, string> = {
        "🫧待孵化": "pw-row-hatch",
        "🔥孵化中": "pw-row-incubate",
        "✅准备好": "pw-row-ready",
        "❌已放弃": "pw-row-abandon",
      };

      const groupLabel = list.createDiv({ cls: `pw-sparks-group ${statusGroupCls[col.status] || ""}` });
      groupLabel.innerHTML = `${iconHTML(statusIcons[col.status] || "pw-spark", 12)} ${col.label} ${colSparks.length}`;

      for (const spark of colSparks) {
        const row = list.createDiv({ cls: `pw-sparks-row ${statusRowCls[spark.status] || ""}` });
        const stale = isStale(spark, this.settings);
        if (stale === "hatch") row.addClass("stale-hatch");
        if (stale === "incubate") row.addClass("stale-incubate");

        const name = spark.title || spark.filePath.split("/").pop() || "";
        const meta: string[] = [];
        if (spark.area) meta.push(spark.area);
        if (spark.staleDays > 0) meta.push(`${spark.staleDays}天`);
        const metaStr = meta.length > 0 ? ` · ${meta.join(" ")}` : "";

        const textEl = row.createSpan({ text: `${name}${metaStr}` });
        textEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.app.workspace.openLinkText(spark.filePath, "", false);
        });

        // 流转按钮
        const statusIdx = STATUS_COLUMNS.findIndex((c) => c.status === spark.status);

        if (statusIdx === 0) {
          // 🫧 → 🔥
          const btn = row.createSpan({ cls: "pw-sparks-next" });
          btn.innerHTML = `${iconHTML("pw-fire", 12)} ${iconHTML("pw-arrow-right", 10)}`;
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await updateSparkStatus(this.app, spark.filePath, "🔥孵化中");
            await this.refresh();
          });
        } else if (statusIdx === 1) {
          // 🔥 → ✅
          const btn = row.createSpan({ cls: "pw-sparks-next" });
          btn.innerHTML = `${iconHTML("pw-check", 12)} ${iconHTML("pw-arrow-right", 10)}`;
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await updateSparkStatus(this.app, spark.filePath, "✅准备好");
            await this.refresh();
          });
        } else if (statusIdx === 2) {
          // ✅ → 创建项目
          const btn = row.createSpan({ cls: "pw-sparks-next" });
          btn.innerHTML = `${iconHTML("pw-project", 12)} 立项`;
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.promoteSparkToProject(spark);
            await this.refresh();
          });
        }
        // ❌已放弃 不显示流转按钮

        row.addEventListener("contextmenu", (e) => {
          const menu = new Menu();
          for (const t of STATUS_COLUMNS) {
            if (t.status !== spark.status) {
              menu.addItem((item) => {
                item.setTitle(`${t.icon} → ${t.label}`);
                item.onClick(async () => {
                  await updateSparkStatus(this.app, spark.filePath, t.status);
                  await this.refresh();
                });
              });
            }
          }
          menu.showAtMouseEvent(e);
        });
      }
    }
  }

  private extractTasks(content: string): { text: string; done: boolean }[] {
    const tasks: { text: string; done: boolean }[] = [];
    for (const line of content.split("\n")) {
      const match = line.match(/^- \[([ xX])\]\s*(.+)/);
      if (match) {
        tasks.push({ done: match[1] !== " ", text: match[2].trim() });
      }
    }
    return tasks;
  }

  // ─── 每日宣言 ───

  private renderMotivation(parent: HTMLElement) {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const { hexagram, quote } = getDailyMotivation(dayOfYear);
    const el = parent.createDiv({ cls: "pw-motivation" });
    el.textContent = `〖${hexagram}卦〗${quote}`;
  }

  // ─── 快捷操作执行 ───

  private async doIngest() {
    if (!this.provider) { new Notice("请先在设置中配置 LLM"); return; }
    this.busy = true;
    try {
      this.setStatus("📥 正在扫描 Inbox...");
      await processInbox(this.app, this.settings, this.provider);
      await this.refresh();
      this.setStatus(`✅ Inbox 处理完成，剩余 ${this.inboxCount} 个文件`, "done");
      setTimeout(() => this.clearStatus(), 3000);
    } catch (e: unknown) {
      this.setStatus(`❌ ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`, "error");
    } finally {
      this.busy = false;
    }
  }

  private async doReview() {
    this.busy = true;
    try {
      this.setStatus("📚 正在加载复习队列...");
      const srsData = await getSRSData(this.plugin);
      const queue = await buildReviewQueue(this.app, this.settings, srsData);
      if (queue.length === 0) {
        this.setStatus("📚 没有需要复习的卡片", "done");
        setTimeout(() => this.clearStatus(), 2000);
        return;
      }
      this.setStatus(`📚 找到 ${queue.length} 张卡片，已打开复习面板`, "done");
      new ReviewModal(this.app, this.plugin, queue, () => this.refresh()).open();
      setTimeout(() => this.clearStatus(), 3000);
    } catch (e: unknown) {
      this.setStatus(`❌ ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`, "error");
    } finally {
      this.busy = false;
    }
  }

  private async doLint() {
    if (!this.provider) { new Notice("请先在设置中配置 LLM"); return; }
    this.busy = true;
    try {
      this.setStatus("🔍 正在扫描 Wiki 页面...");
      await lintWiki(this.app, this.settings, this.provider);
      this.setStatus("✅ 健康检查完成，详见 lint-report.md", "done");
      setTimeout(() => this.clearStatus(), 3000);
    } catch (e: unknown) {
      this.setStatus(`❌ ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`, "error");
    } finally {
      this.busy = false;
    }
  }

  private async doWeekly() {
    this.busy = true;
    try {
      this.setStatus("📊 正在收集本周数据...");
      const stats = await collectWeeklyStats(this.app, this.settings, this.plugin);
      this.setStatus("📊 正在生成周报...");
      const path = await generateWeeklyReport(this.app, this.settings, stats);
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file) await this.app.workspace.getLeaf(false).openFile(file as any);
      this.setStatus("✅ 周报已生成并打开", "done");
      setTimeout(() => this.clearStatus(), 3000);
    } catch (e: unknown) {
      this.setStatus(`❌ ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`, "error");
    } finally {
      this.busy = false;
    }
  }

  private async doFormat() {
    if (!this.provider) { new Notice("请先在设置中配置 LLM"); return; }
    const { editor, view } = this.getActiveEditor() ?? {};
    if (!editor || !view) { this.setStatus("❌ 请先打开一个笔记", "error"); return; }
    this.busy = true;
    try {
      this.setStatus("✨ 正在读取笔记内容...");
      await formatNote(this.app, editor, view, this.provider);
      this.setStatus("✅ 排版整理完成", "done");
      setTimeout(() => this.clearStatus(), 3000);
    } catch (e: unknown) {
      this.setStatus(`❌ ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`, "error");
    } finally {
      this.busy = false;
    }
  }

  private async doContinue() {
    if (!this.provider) { new Notice("请先在设置中配置 LLM"); return; }
    const { editor, view } = this.getActiveEditor() ?? {};
    if (!editor || !view) { this.setStatus("❌ 请先打开一个笔记", "error"); return; }
    this.busy = true;
    try {
      this.setStatus("✍️ 正在分析笔记...");
      await continueWriting(this.app, editor, view, this.provider);
      this.setStatus("✅ 写作建议已插入", "done");
      setTimeout(() => this.clearStatus(), 3000);
    } catch (e: unknown) {
      this.setStatus(`❌ ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`, "error");
    } finally {
      this.busy = false;
    }
  }

  // ─── 灵感升级为项目 ───

  private async promoteSparkToProject(spark: Spark) {
    const title = (spark.title || spark.filePath.split("/").pop() || "新项目").replace(/[/\\?%*:|"<>]/g, "-");
    const projectPath = normalizePath(`${this.settings.projectsPath}/${title}.md`);
    const today = new Date().toISOString().slice(0, 10);

    if (this.app.vault.getAbstractFileByPath(projectPath)) {
      new Notice("同名项目已存在");
      return;
    }

    // 创建项目文件
    const content = [
      "---",
      "type: 项目计划",
      "stage: 规划",
      `area: "${spark.area}"`,
      "status: 进行中",
      `date_start: ${today}`,
      "date_end:",
      "tags:",
      "  - 项目",
      `created: ${today}`,
      "---",
      "",
      `> [!target] 目标`,
      `> 由灵感「${spark.title}」孵化而来`,
      "",
      "***",
      "",
      "**成功标准**",
      "- [ ] ",
      "",
      "***",
      "",
      "**关键节点**",
      "- [ ] ",
      "",
      "***",
      "",
      "**下一步**",
      "- [ ] ",
      "",
    ].join("\n");

    await this.app.vault.create(projectPath, content);

    // 把灵感状态改为已放弃（已转化为项目）
    await updateSparkStatus(this.app, spark.filePath, "❌已放弃");

    // 更新灵感的 frontmatter，记录去向
    const sparkFile = this.app.vault.getAbstractFileByPath(spark.filePath);
    if (sparkFile && sparkFile instanceof TFile) {
      await this.app.fileManager.processFrontMatter(sparkFile, (fm) => {
        fm.promoted_to = `1-Projects/${title}`;
        fm.spark_status = "❌已放弃";
      });
    }

    // 打开项目文件
    const file = this.app.vault.getAbstractFileByPath(projectPath);
    if (file) await this.app.workspace.getLeaf(false).openFile(file as any);

    new Notice(`📋 项目已创建：${title}`);
  }

  // ─── 快速创建灵感 ───

  private async createSpark(text: string) {
    const title = text.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);
    const path = normalizePath(`${this.settings.sparksPath}/${title}.md`);
    const today = new Date().toISOString().slice(0, 10);

    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice("同名灵感已存在");
      return;
    }

    const content = [
      "---",
      "type: 灵感卡片",
      "stage: 待孵化",
      "spark_status: 🫧待孵化",
      `title: "${text}"`,
      'source: "看板快记"',
      'area: ""',
      'project: ""',
      "tags:",
      "  - 灵感",
      `created: ${today}`,
      `updated: ${today}`,
      "---",
      "",
      `## ${text}`,
      "",
    ].join("\n");

    await this.app.vault.create(path, content);
    await this.refresh();
    new Notice(`🫧 灵感已创建：${title}`);
  }

  // ─── UI 辅助 ───

  private getActiveEditor(): { editor: any; view: MarkdownView } | null {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    if (leaves.length === 0) return null;
    const mainLeaf = leaves.find((l) => !(l as any).isFloating) || leaves[0];
    const view = mainLeaf.view as MarkdownView;
    const editor = view?.editor;
    if (!editor || !view?.file) return null;
    return { editor, view };
  }

  private stat(parent: HTMLElement, icon: string, value: number, label: string) {
    const card = parent.createDiv({ cls: "pw-stat-card" });
    card.createDiv({ cls: "value" }).innerHTML = `${iconHTML(icon, 18)} ${value}`;
    card.createDiv({ cls: "label", text: label });
  }

  private actionBtn(parent: HTMLElement, icon: string, text: string, onClick: () => Promise<void>) {
    const btn = parent.createEl("button", { cls: "pw-action-btn" });
    btn.innerHTML = `${iconHTML(icon, 13)} ${text}`;
    const original = btn.innerHTML;
    btn.addEventListener("click", async () => {
      if (this.busy) return;
      btn.disabled = true;
      btn.addClass("pw-action-loading");
      try {
        await onClick();
      } finally {
        btn.innerHTML = original;
        btn.disabled = false;
        btn.removeClass("pw-action-loading");
      }
    });
  }
}

// Local date string (avoids UTC timezone shift from toISOString)
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
