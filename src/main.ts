import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS } from "./types";
import type { ParaWavesSettings } from "./types";
import { ParaWavesSettingTab } from "./settings";
import { scaffoldVault } from "./init/scaffolder";
import { createProvider } from "./llm/provider";
import type { LLMProvider } from "./llm/provider";
import { SPARKS_VIEW_TYPE, SparksView } from "./sparks/SparksView";
import { getSRSData, buildReviewQueue } from "./srs/review-scheduler";
import { ReviewModal } from "./srs/review-modal";
import { processInbox } from "./wiki/ingest";
import { WikiChatModal } from "./wiki/wiki-chat-modal";
import { lintWiki } from "./wiki/lint";
import { collectWeeklyStats, generateWeeklyReport } from "./weekly/weekly-report";
import { buildEmbeddingIndex, updateEmbeddingIndex } from "./wiki/embedding-index";

export default class ParaWavesPlugin extends Plugin {
  settings: ParaWavesSettings = { ...DEFAULT_SETTINGS };
  llmProvider: LLMProvider | null = null;

  async onload() {
    await this.loadSettings();
    this.initLLM();

    // ─── 注册 Sparks 视图 ───
    this.registerView(SPARKS_VIEW_TYPE, (leaf: WorkspaceLeaf) => new SparksView(leaf, this.settings, this));

    // ─── 命令注册 ───

    // Phase 1: 初始化 Vault
    this.addCommand({
      id: "init-vault",
      name: "初始化 Vault 结构",
      callback: () => scaffoldVault(this.app, this.settings),
    });

    // Phase 2: 测试 LLM
    this.addCommand({
      id: "test-llm",
      name: "测试 LLM 连接",
      callback: async () => {
        if (!this.llmProvider) {
          new Notice("请先在设置中配置 LLM API Key");
          return;
        }
        try {
          new Notice("正在测试连接...");
          const reply = await this.llmProvider.chat([
            { role: "user", content: "说一个字：好" },
          ]);
          new Notice(`连接成功: ${reply.substring(0, 50)}`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          new Notice(`连接失败: ${msg}`);
        }
      },
    });

    // Phase 3: Sparks 看板
    this.addCommand({
      id: "open-sparks",
      name: "打开 Sparks 看板",
      callback: () => {
        const existing = this.app.workspace.getLeavesOfType(SPARKS_VIEW_TYPE);
        if (existing.length > 0) {
          this.app.workspace.revealLeaf(existing[0]);
        } else {
          this.app.workspace.getRightLeaf(false)?.setViewState({
            type: SPARKS_VIEW_TYPE,
            active: true,
          });
        }
      },
    });

    // Phase 4: 间隔重复复习
    this.addCommand({
      id: "review-due",
      name: "复习到期卡片",
      callback: async () => {
        const srsData = await getSRSData(this);
        const queue = await buildReviewQueue(this.app, this.settings, srsData);
        if (queue.length === 0) {
          new Notice("没有需要复习的卡片");
          return;
        }
        new ReviewModal(this.app, this, queue, () => {}).open();
      },
    });

    // Phase 5: Wiki Ingest
    this.addCommand({
      id: "wiki-ingest",
      name: "Wiki: 处理 Inbox",
      callback: async () => {
        if (!this.llmProvider) {
          new Notice("请先在设置中配置 LLM");
          return;
        }
        await processInbox(this.app, this.settings, this.llmProvider);
      },
    });

    // Phase 5: Wiki Query
    this.addCommand({
      id: "wiki-ask",
      name: "Wiki: 提问",
      callback: () => {
        if (!this.llmProvider) {
          new Notice("请先在设置中配置 LLM");
          return;
        }
        new WikiChatModal(this.app, this.settings, this.llmProvider).open();
      },
    });

    // Phase 5: Wiki Lint
    this.addCommand({
      id: "wiki-lint",
      name: "Wiki: 健康检查",
      callback: async () => {
        if (!this.llmProvider) {
          new Notice("请先在设置中配置 LLM");
          return;
        }
        await lintWiki(this.app, this.settings, this.llmProvider);
      },
    });

    // Phase 6: 周报
    this.addCommand({
      id: "weekly-report",
      name: "生成本周回顾",
      callback: async () => {
        const stats = await collectWeeklyStats(this.app, this.settings, this);
        const path = await generateWeeklyReport(this.app, this.settings, stats);
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) {
          await this.app.workspace.getLeaf(false).openFile(file as any);
        }
      },
    });

    // Embedding 索引
    this.addCommand({
      id: "rebuild-embedding-index",
      name: "重建 Wiki Embedding 索引",
      callback: async () => {
        if (!this.llmProvider) {
          new Notice("请先在设置中配置 LLM");
          return;
        }
        try {
          await buildEmbeddingIndex(this.app, this.settings, this.llmProvider, this);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          new Notice(`索引构建失败: ${msg.substring(0, 80)}`);
        }
      },
    });

    // 设置页
    this.addSettingTab(new ParaWavesSettingTab(this.app, this));

    // Ribbon 图标
    this.addRibbonIcon("sparkles", "Sparks 看板", () => {
      (this.app as any).commands.executeCommandById("para-waves:open-sparks");
    });

    // Wiki 文件变更时自动增量更新 embedding 索引
    this.registerEvent(this.app.vault.on("create", async (file) => {
      if (file.path.startsWith(this.settings.wikiPath) && this.llmProvider) {
        try { await updateEmbeddingIndex(this.app, this.settings, this.llmProvider, this); } catch {}
      }
    }));
    this.registerEvent(this.app.vault.on("modify", async (file) => {
      if (file.path.startsWith(this.settings.wikiPath) && this.llmProvider) {
        try { await updateEmbeddingIndex(this.app, this.settings, this.llmProvider, this); } catch {}
      }
    }));
  }

  onunload() {
    // 清理视图
    this.app.workspace.detachLeavesOfType(SPARKS_VIEW_TYPE);
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.initLLM();
  }

  private initLLM() {
    if (this.settings.llm.apiKey) {
      try {
        this.llmProvider = createProvider(this.settings.llm);
      } catch {
        this.llmProvider = null;
      }
    }
  }
}
