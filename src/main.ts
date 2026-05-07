import { MarkdownView, Notice, Plugin, WorkspaceLeaf, normalizePath, TFile, addIcon } from "obsidian";
import { DEFAULT_SETTINGS } from "./types";
import type { ParaWavesSettings } from "./types";
import { ParaWavesSettingTab } from "./settings";
import { scaffoldVault } from "./init/scaffolder";
import { createProvider } from "./llm/provider";
import type { LLMProvider } from "./llm/provider";
import { SPARKS_VIEW_TYPE, SparksView } from "./sparks/SparksView";
import { getSRSData, buildReviewQueue } from "./srs/review-scheduler";
import { ReviewModal } from "./srs/review-modal";
import { PENSEA_ICON_SMALL } from "./utils/plugin-icon";
import { processInbox } from "./wiki/ingest";
import { WikiChatModal } from "./wiki/wiki-chat-modal";
import { lintWiki } from "./wiki/lint";
import { collectWeeklyStats, generateWeeklyReport } from "./weekly/weekly-report";
import { buildEmbeddingIndex, updateEmbeddingIndex } from "./wiki/embedding-index";
import { formatNote, continueWriting, polishText, expandText, condenseText, rewriteStyle, AVAILABLE_STYLES } from "./editor/writing-assist";
import { StylePickerModal } from "./editor/style-picker-modal";
import { archiveMonthlyDaily } from "./daily/monthly-archiver";
import { registerPWIcons } from "./utils/icons";
import { autoTitleFile, isGenericName } from "./editor/auto-title";

export default class ParaWavesPlugin extends Plugin {
  settings: ParaWavesSettings = { ...DEFAULT_SETTINGS };
  llmProvider: LLMProvider | null = null;

  async onload() {
    await this.loadSettings();
    this.initLLM();
    registerPWIcons((id: string, svg: string) => addIcon(id, svg));

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

    // 写作助手：整理排版
    this.addCommand({
      id: "format-note",
      name: "整理笔记排版",
      editorCallback: async (editor, view) => {
        if (!this.llmProvider) {
          new Notice("请先在设置中配置 LLM");
          return;
        }
        if (!(view instanceof MarkdownView)) return;
        await formatNote(this.app, editor, view, this.llmProvider);
      },
    });

    // 写作助手：继续写
    this.addCommand({
      id: "continue-writing",
      name: "继续写",
      editorCallback: async (editor, view) => {
        if (!this.llmProvider) {
          new Notice("请先在设置中配置 LLM");
          return;
        }
        if (!(view instanceof MarkdownView)) return;
        await continueWriting(this.app, editor, view, this.llmProvider);
      },
    });

    // 月度归档
    this.addCommand({
      id: "archive-monthly-daily",
      name: "归档上月日记",
      callback: async () => {
        await archiveMonthlyDaily(this.app, this.settings);
      },
    });

    // 智能命名
    this.addCommand({
      id: "smart-rename",
      name: "智能命名当前笔记",
      editorCallback: async (_editor, view) => {
        if (!this.llmProvider) { new Notice("请先在设置中配置 LLM"); return; }
        const file = view.file;
        if (!file) return;
        new Notice("正在生成标题...");
        const title = await autoTitleFile(this.app, file, this.llmProvider);
        if (title) {
          new Notice(`已重命名为：${title}`);
        } else {
          new Notice("无法生成更好的标题");
        }
      },
    });

    // 右键菜单
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) return;
        const selected = editor.getSelection().trim();

        // ─── 选中文字时：灵感 + AI 改写 ───
        if (selected) {
          menu.addItem((item) => {
            item.setTitle("🫧 转为灵感").onClick(async () => {
              const title = selected.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);
              const sparkPath = normalizePath(`${this.settings.sparksPath}/${title}.md`);
              if (this.app.vault.getAbstractFileByPath(sparkPath)) {
                new Notice("同名灵感已存在");
                return;
              }
              const source = view.file?.path ?? "";
              const today = localDateStr(new Date());
              const content = [
                "---",
                "type: 灵感卡片",
                "stage: 待孵化",
                "spark_status: 🫧待孵化",
                `title: "${selected.substring(0, 100)}"`,
                `source: "[[${source}]]"`,
                'area: ""',
                'project: ""',
                "tags:",
                "  - 灵感",
                `created: ${today}`,
                `updated: ${today}`,
                "---",
                "",
                `## ${selected.substring(0, 100)}`,
                "",
              ].join("\n");
              await this.app.vault.create(sparkPath, content);
              new Notice(`🫧 灵感已创建：${title}`);
            });
          });

          if (this.llmProvider) {
            menu.addSeparator();
            menu.addItem((item) => {
              item.setTitle("✨ 润色").onClick(async () => {
                try { new Notice("正在润色..."); await polishText(editor, this.llmProvider!); new Notice("润色完成"); }
                catch (e) { new Notice(`润色失败: ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`); }
              });
            });
            menu.addItem((item) => {
              item.setTitle("📝 扩写").onClick(async () => {
                try { new Notice("正在扩写..."); await expandText(editor, this.llmProvider!); new Notice("扩写完成"); }
                catch (e) { new Notice(`扩写失败: ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`); }
              });
            });
            menu.addItem((item) => {
              item.setTitle("✂️ 缩写").onClick(async () => {
                try { new Notice("正在缩写..."); await condenseText(editor, this.llmProvider!); new Notice("缩写完成"); }
                catch (e) { new Notice(`缩写失败: ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`); }
              });
            });
            menu.addItem((item) => {
              item.setTitle("🎨 改写风格").onClick(async () => {
                new StylePickerModal(this.app, this.llmProvider!, editor).open();
              });
            });
          }
        }

        // ─── 笔记级功能（不需要选中文字）───
        if (this.llmProvider && view.file) {
          if (selected) menu.addSeparator();
          menu.addItem((item) => {
            item.setTitle("🏷️ 智能命名").onClick(async () => {
              const file = view.file;
              if (!file) return;
              try { new Notice("正在生成标题..."); const title = await autoTitleFile(this.app, file, this.llmProvider!); if (title) { new Notice(`已重命名：${title}`); } else { new Notice("无法生成更好的标题"); } }
              catch (e) { new Notice(`命名失败: ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`); }
            });
          });
        }
      })
    );

    // 设置页
    this.addSettingTab(new ParaWavesSettingTab(this.app, this));

    // Ribbon 图标
    addIcon("pensea", PENSEA_ICON_SMALL);
    this.addRibbonIcon("pensea", "Pensea", () => {
      (this.app as any).commands.executeCommandById("pensea:open-sparks");
    });

    // Wiki 文件变更时自动增量更新 embedding 索引（带节流）
    let embeddingTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedEmbedding = () => {
      if (embeddingTimer) clearTimeout(embeddingTimer);
      embeddingTimer = setTimeout(async () => {
        if (!this.llmProvider) return;
        try { await updateEmbeddingIndex(this.app, this.settings, this.llmProvider, this); } catch {}
        embeddingTimer = null;
      }, 10_000);
    };
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file.path.startsWith(this.settings.wikiPath) && this.llmProvider) debouncedEmbedding();
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.path.startsWith(this.settings.wikiPath) && this.llmProvider) debouncedEmbedding();
    }));

    // 点击日记中的前一天/后一天链接时，自动用模板填充空白的日记
    this.registerEvent(this.app.vault.on("create", async (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      const ds = file.basename;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;

      const content = await this.app.vault.read(file);
      if (content.trim() !== "") return;

      // 如果文件不在 Daily 目录下，移过去
      let targetFile = file;
      const dailyDir = this.settings.dailyPath;
      if (!file.path.startsWith(dailyDir + "/")) {
        const newPath = normalizePath(`${dailyDir}/${file.name}`);
        if (!this.app.vault.getAbstractFileByPath(newPath)) {
          await this.app.fileManager.renameFile(file, newPath);
          targetFile = this.app.vault.getAbstractFileByPath(newPath) as TFile;
        }
      }
      if (!targetFile) return;

      const template = await this.generateDailyTemplate(ds);
      await this.app.vault.modify(targetFile, template);
    }));

    // 自动智能命名：文件修改时，如果是默认名且有足够内容，自动生成标题
    const autoTitledFiles = new Set<string>();
    if (this.llmProvider) {
      let autoTitleTimer: ReturnType<typeof setTimeout> | null = null;
      this.registerEvent(this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        if (!isGenericName(file.basename)) return;
        if (autoTitledFiles.has(file.path)) return;
        const f = file;
        if (autoTitleTimer) clearTimeout(autoTitleTimer);
        autoTitleTimer = setTimeout(async () => {
          autoTitleTimer = null;
          if (autoTitledFiles.has(f.path)) return;
          try {
            const title = await autoTitleFile(this.app, f, this.llmProvider!);
            if (title) {
              autoTitledFiles.add(f.path);
              new Notice(`已自动命名为：${title}`);
            }
          } catch {}
        }, 10_000);
      }));
    }
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

  async generateDailyTemplate(ds: string): Promise<string> {
    const [year, month, day] = ds.split("-").map(Number);
    const today = new Date(year, month - 1, day);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = localDateStr(yesterday);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const td = localDateStr(tomorrow);

    // 迁移昨天的未完成任务
    let migratedTasks = "";
    const yesterdayPath = normalizePath(`${this.settings.dailyPath}/${yd}.md`);
    const yesterdayFile = this.app.vault.getAbstractFileByPath(yesterdayPath);
    if (yesterdayFile && yesterdayFile instanceof TFile) {
      const content = await this.app.vault.cachedRead(yesterdayFile);
      for (const line of content.split("\n")) {
        const match = line.match(/^- \[ \]\s*(.+)/);
        if (match && match[1].trim()) {
          migratedTasks += `- [ ] ${match[1].trim()}\n`;
        }
      }
    }

    return [
      "---",
      "type: 日记",
      `date: ${ds}`,
      'weather: ""',
      'mood: ""',
      "tags:",
      "  - 日记",
      `created: ${ds}`,
      "---",
      "",
      `<< [[${yd}]] | [[${td}]] >>`,
      "",
      "## Tasks",
      "",
      migratedTasks + "- [ ] ",
      "",
      "## Log",
      "",
      "",
    ].join("\n");
  }
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
