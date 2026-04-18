import { ItemView, WorkspaceLeaf, Menu, Notice, TFile, normalizePath } from "obsidian";
import type { Spark, SparkStatus, ParaWavesSettings, LLMMessage } from "../types";
import { scanSparks, isStale, updateSparkStatus } from "./spark-engine";
import { processInbox } from "../wiki/ingest";
import { queryWiki } from "../wiki/query";
import { lintWiki } from "../wiki/lint";
import { collectWeeklyStats, generateWeeklyReport } from "../weekly/weekly-report";
import { getSRSData, buildReviewQueue, applyReview } from "../srs/review-scheduler";
import { ReviewModal } from "../srs/review-modal";
import type { LLMProvider } from "../llm/provider";
import { buildEmbeddingIndex } from "../wiki/embedding-index";

export const SPARKS_VIEW_TYPE = "para-waves-sparks";

const STATUS_COLUMNS: { status: SparkStatus; icon: string; label: string }[] = [
  { status: "🫧待孵化", icon: "🫧", label: "待孵化" },
  { status: "🔥孵化中", icon: "🔥", label: "孵化中" },
  { status: "✅准备好", icon: "✅", label: "准备好" },
  { status: "❌已放弃", icon: "❌", label: "已放弃" },
];

// waves 意图识别 system prompt
const INTENT_SYSTEM = `你是 waves，ParaWaves 知识管理系统的 AI 助手。用户会用自然语言跟你说话，你需要判断意图并执行。

支持的意图和对应的 JSON 回复格式（不要加 markdown 代码块）：

1. 处理 Inbox → {"intent":"ingest"}
   触发词：处理inbox、整理inbox、分类、归档、清理

2. 创建灵感 → {"intent":"create_spark","title":"灵感标题","description":"一句话描述","area":"领域","source":"来源"}
   触发词：我有个灵感、新想法、记录一个灵感

3. 查询知识库 → {"intent":"query","question":"用户的问题"}
   触发词：帮我查、wiki、知识库里有没有、关于XX的笔记

4. 复习卡片 → {"intent":"review"}
   触发词：复习、复习卡片、有什么要复习的

5. 健康检查 → {"intent":"lint"}
   触发词：检查、体检、健康检查、有没有问题

6. 生成周报 → {"intent":"weekly"}
   触发词：周报、本周回顾、生成周报

7. 重建索引 → {"intent":"rebuild_index"}
   触发词：重建索引、更新索引、构建索引、索引

8. 普通聊天/回答问题 → {"intent":"chat","reply":"你的回答"}
   其他所有情况：闲聊、问问题、求助等

只返回 JSON，不要其他内容。`;

export class SparksView extends ItemView {
  private settings: ParaWavesSettings;
  private plugin: any;
  private sparks: Spark[] = [];
  private inboxCount = 0;
  private dueReviews = 0;
  private wikiTotal = 0;
  private dragSrcPath: string | null = null;
  private chatMessages: { role: string; content: string }[] = [];
  private chatContainer: HTMLElement | null = null;

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
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), 500);
  }

  async refresh() {
    this.sparks = await scanSparks(this.app, this.settings);
    // 统计
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

  private render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("pw-dashboard");

    // ─── 统计 ───
    const stats = el.createDiv({ cls: "pw-stats-row" });
    this.stat(stats, "📥", this.inboxCount, "Inbox");
    this.stat(stats, "🫧", this.sparks.length, "Sparks");
    this.stat(stats, "📚", this.dueReviews, "待复习");
    this.stat(stats, "📝", this.wikiTotal, "Wiki");

    // ─── Sparks 看板（可折叠）───
    const sparkSection = el.createDiv({ cls: "pw-section" });
    const sparkHeader = sparkSection.createDiv({ cls: "pw-section-header" });
    sparkHeader.textContent = "🫧 Sparks 灵感池";
    let sparkVisible = true;
    sparkHeader.addEventListener("click", () => {
      sparkVisible = !sparkVisible;
      board.style.display = sparkVisible ? "" : "none";
      sparkHeader.textContent = sparkVisible ? "🫧 Sparks 灵感池" : "🫧 Sparks ▸";
    });

    const board = sparkSection.createDiv({ cls: "pw-sparks-board" });
    for (const col of STATUS_COLUMNS) {
      const colSparks = this.sparks.filter((s) => s.status === col.status);
      const colEl = board.createDiv({ cls: "pw-sparks-column" });
      const hdr = colEl.createDiv({ cls: "pw-sparks-column-header" });
      hdr.textContent = `${col.icon} ${col.label}`;
      hdr.createSpan({ cls: "count", text: `(${colSparks.length})` });

      colEl.addEventListener("dragover", (e) => { e.preventDefault(); colEl.addClass("drag-over"); });
      colEl.addEventListener("dragleave", () => colEl.removeClass("drag-over"));
      colEl.addEventListener("drop", async (e) => {
        e.preventDefault(); colEl.removeClass("drag-over");
        if (this.dragSrcPath) {
          await updateSparkStatus(this.app, this.dragSrcPath, col.status);
          this.dragSrcPath = null;
          await this.refresh();
        }
      });

      for (const spark of colSparks) {
        const card = colEl.createDiv({ cls: "pw-spark-card" });
        const stale = isStale(spark, this.settings);
        if (stale === "hatch") card.addClass("stale-hatch");
        if (stale === "incubate") card.addClass("stale-incubate");
        card.createDiv({ cls: "title", text: spark.title || spark.filePath.split("/").pop() });
        const meta = card.createDiv({ cls: "meta" });
        const p: string[] = [];
        if (spark.area) p.push(spark.area);
        if (spark.staleDays > 0) p.push(`${spark.staleDays}天`);
        meta.textContent = p.join(" · ");

        card.setAttr("draggable", "true");
        card.addEventListener("dragstart", () => { this.dragSrcPath = spark.filePath; });
        card.addEventListener("click", () => this.app.workspace.openLinkText(spark.filePath, "", false));
        card.addEventListener("contextmenu", (e) => {
          const menu = new Menu();
          for (const t of STATUS_COLUMNS) {
            if (t.status !== spark.status) {
              menu.addItem((item) => {
                item.setTitle(`${t.icon} → ${t.label}`);
                item.onClick(async () => { await updateSparkStatus(this.app, spark.filePath, t.status); await this.refresh(); });
              });
            }
          }
          menu.showAtMouseEvent(e);
        });
      }
    }

    // ─── waves 聊天区 ───
    const chatSection = el.createDiv({ cls: "pw-chat-section" });
    const chatHeader = chatSection.createDiv({ cls: "pw-section-header" });
    chatHeader.textContent = "🌊 waves 助手";

    this.chatContainer = chatSection.createDiv({ cls: "pw-chat-messages" });

    // 恢复历史消息
    for (const msg of this.chatMessages) {
      this.renderChatMsg(msg.role, msg.content);
    }

    const inputRow = chatSection.createDiv({ cls: "pw-chat-input-row" });
    const input = inputRow.createEl("input", { type: "text", placeholder: "跟 waves 说点什么..." });
    const sendBtn = inputRow.createEl("button", { text: "发送", cls: "mod-cta" });

    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      this.addChatMsg("user", text);
      await this.handleWavesMessage(text);
      input.focus();
    };

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  }

  // ─── waves 核心：意图识别 + 执行 ───

  private async handleWavesMessage(text: string) {
    const provider: LLMProvider | null = this.plugin.llmProvider;
    if (!provider) {
      this.addChatMsg("waves", "⚠️ 还没配置 LLM，请先到设置里填上 API Key");
      return;
    }

    // 意图识别
    try {
      const reply = await provider.chat(
        [{ role: "user", content: text }],
        INTENT_SYSTEM
      );
      const intent = this.parseIntent(reply);

      switch (intent.intent) {
        case "ingest":
          this.addChatMsg("waves", "📥 正在处理 Inbox...");
          await processInbox(this.app, this.settings, provider);
          await this.refresh();
          this.addChatMsg("waves", `✅ Inbox 处理完成！当前 Inbox 剩余 ${this.inboxCount} 个文件`);
          break;

        case "create_spark": {
          const title = intent.title || text.substring(0, 30);
          const desc = intent.description || "";
          const area = intent.area || "";
          const source = intent.source || "对话";
          const safeName = title.replace(/[/\\?%*:|"<>]/g, "-");
          const path = normalizePath(`${this.settings.sparksPath}/${safeName}.md`);
          const today = new Date().toISOString().slice(0, 10);
          const content = [
            "---",
            "type: 灵感卡片",
            "stage: 待孵化",
            `spark_status: 🫧待孵化`,
            `title: "${title}"`,
            `source: "${source}"`,
            `area: "${area}"`,
            'project: ""',
            "related: []",
            "tags:",
            "  - 灵感",
            `created: ${today}`,
            `updated: ${today}`,
            "---",
            "",
            `## 一句话描述`,
            "",
            desc,
            "",
          ].join("\n");
          if (!this.app.vault.getAbstractFileByPath(path)) {
            await this.app.vault.create(path, content);
            await this.refresh();
            this.addChatMsg("waves", `🫧 灵感已创建：[[${safeName}]]`);
          } else {
            this.addChatMsg("waves", "⚠️ 同名灵感已存在");
          }
          break;
        }

        case "query": {
          this.addChatMsg("waves", "🔍 正在查询知识库...");
          const answer = await queryWiki(this.app, this.settings, provider, intent.question || text, this.plugin);
          // 截取前 300 字显示在聊天中
          const preview = answer.length > 300 ? answer.substring(0, 300) + "..." : answer;
          this.addChatMsg("waves", preview);
          break;
        }

        case "review": {
          const srsData = await getSRSData(this.plugin);
          const queue = await buildReviewQueue(this.app, this.settings, srsData);
          if (queue.length === 0) {
            this.addChatMsg("waves", "📚 目前没有需要复习的卡片，做得好！");
          } else {
            this.addChatMsg("waves", `📚 有 ${queue.length} 张卡片需要复习，正在打开复习面板...`);
            new ReviewModal(this.app, this.plugin, queue, () => this.refresh()).open();
          }
          break;
        }

        case "lint":
          this.addChatMsg("waves", "🔍 正在检查 Wiki 健康...");
          await lintWiki(this.app, this.settings, provider);
          this.addChatMsg("waves", "✅ 健康检查完成，详见 lint-report.md");
          break;

        case "weekly": {
          const stats = await collectWeeklyStats(this.app, this.settings, this.plugin);
          const path = await generateWeeklyReport(this.app, this.settings, stats);
          const file = this.app.vault.getAbstractFileByPath(path);
          if (file) await this.app.workspace.getLeaf(false).openFile(file as any);
          this.addChatMsg("waves", `📊 周报已生成并打开！本周新建 ${stats.newNotes} 篇笔记，${stats.reviewsCompleted} 次复习`);
          break;
        }

        case "rebuild_index": {
          this.addChatMsg("waves", "🔍 正在重建 Wiki Embedding 索引...");
          const count = await buildEmbeddingIndex(this.app, this.settings, provider, this.plugin);
          this.addChatMsg("waves", `✅ 索引构建完成！共索引 ${count} 个 Wiki 页面`);
          break;
        }

        case "chat":
        default:
          this.addChatMsg("waves", intent.reply || "你好！我是 waves，你可以让我处理 Inbox、创建灵感、查询知识库、复习卡片、健康检查、生成周报、重建索引，或者随便聊聊");
          break;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.addChatMsg("waves", `❌ 出错了：${msg.substring(0, 100)}`);
    }
  }

  private parseIntent(reply: string): Record<string, any> {
    // 提取 JSON
    const braceStart = reply.indexOf("{");
    const braceEnd = reply.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      try {
        return JSON.parse(reply.substring(braceStart, braceEnd + 1));
      } catch { /* fall */ }
    }
    return { intent: "chat", reply: reply };
  }

  // ─── 聊天 UI ───

  private addChatMsg(role: string, content: string) {
    this.chatMessages.push({ role, content });
    // 只保留最近 50 条
    if (this.chatMessages.length > 50) this.chatMessages = this.chatMessages.slice(-30);
    this.renderChatMsg(role, content);
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  private renderChatMsg(role: string, content: string) {
    if (!this.chatContainer) return;
    const msg = this.chatContainer.createDiv({ cls: `pw-chat-msg ${role}` });
    msg.textContent = content;
  }

  // ─── 辅助 ───

  private stat(parent: HTMLElement, icon: string, value: number, label: string) {
    const card = parent.createDiv({ cls: "pw-stat-card" });
    card.createDiv({ cls: "value", text: `${icon} ${value}` });
    card.createDiv({ cls: "label", text: label });
  }
}
