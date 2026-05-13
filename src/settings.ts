import { App, PluginSettingTab, Setting } from "obsidian";
import type ParaWavesPlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";
import type { ParaWavesSettings } from "./types";

const PROVIDERS = [
  { name: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { name: "Kimi (Moonshot)", baseURL: "https://api.moonshot.cn/v1", model: "moonshot-v1-auto" },
  { name: "MiniMax", baseURL: "https://api.minimax.chat/v1", model: "MiniMax-Text-01" },
  { name: "GLM (Zhipu)", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.1" },
  { name: "Ollama (本地)", baseURL: "http://localhost:11434/v1", model: "qwen2.5:7b" },
  { name: "Claude (Anthropic)", baseURL: "https://api.anthropic.com", model: "claude-sonnet-4-20250514" },
  { name: "Gemini (Google)", baseURL: "https://generativelanguage.googleapis.com", model: "gemini-2.0-flash" },
  { name: "自定义", baseURL: "", model: "" },
] as const;

export class ParaWavesSettingTab extends PluginSettingTab {
  plugin: ParaWavesPlugin;

  constructor(app: App, plugin: ParaWavesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Pensea 设置" });

    // ─── LLM 配置 ───
    containerEl.createEl("h3", { text: "LLM 提供商" });

    new Setting(containerEl)
      .setName("提供商预设")
      .setDesc("选择预设自动填充 baseURL 和模型")
      .addDropdown((dd) => {
        PROVIDERS.forEach((p, i) => dd.addOption(String(i), p.name));
        // 预选当前 provider
        const currentBaseURL = this.plugin.settings.llm.baseURL;
        const currentIdx = PROVIDERS.findIndex((p) => p.baseURL === currentBaseURL);
        if (currentIdx >= 0) dd.setValue(String(currentIdx));
        dd.onChange(async (val) => {
          const preset = PROVIDERS[Number(val)];
          this.plugin.settings.llm.baseURL = preset.baseURL;
          this.plugin.settings.llm.model = preset.model;
          if (preset.name === "Claude (Anthropic)") {
            this.plugin.settings.llm.provider = "claude";
          } else if (preset.name === "Gemini (Google)") {
            this.plugin.settings.llm.provider = "gemini";
          } else {
            this.plugin.settings.llm.provider = "openai-compat";
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("API 端点地址")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.llm.baseURL)
          .onChange(async (value) => {
            this.plugin.settings.llm.baseURL = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("你的 API 密钥")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.llm.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.llm.apiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc("使用的模型名称")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4o-mini")
          .setValue(this.plugin.settings.llm.model)
          .onChange(async (value) => {
            this.plugin.settings.llm.model = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("温度")
      .setDesc("0=确定性, 1=创造性")
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.llm.temperature ?? 0.3)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.llm.temperature = value;
            await this.plugin.saveSettings();
          })
      );

    // ─── Embedding 配置 ───
    containerEl.createEl("h3", { text: "Embedding 模型（语义搜索）" });
    containerEl.createEl("p", {
      text: "Kimi、Claude 不提供 Embedding API，需填写下方独立地址（如 OpenAI、DeepSeek）。GLM 原生支持 Embedding，无需额外配置。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Embedding 模型")
      .setDesc("用于语义搜索的 embedding 模型名称")
      .addText((text) =>
        text
          .setPlaceholder("text-embedding-3-small")
          .setValue(this.plugin.settings.llm.embeddingModel ?? "")
          .onChange(async (value) => {
            this.plugin.settings.llm.embeddingModel = value || undefined;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Embedding API 地址")
      .setDesc("留空则使用与 Chat 相同的 API。Claude 用户需填写支持 embedding 的 API 地址（如 OpenAI/DeepSeek）")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.llm.embeddingBaseURL ?? "")
          .onChange(async (value) => {
            this.plugin.settings.llm.embeddingBaseURL = value || undefined;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Embedding API Key")
      .setDesc("留空则使用与 Chat 相同的 Key")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.llm.embeddingApiKey ?? "")
          .onChange(async (value) => {
            this.plugin.settings.llm.embeddingApiKey = value || undefined;
            await this.plugin.saveSettings();
          });
      });

    // ─── 测试连接 ───
    new Setting(containerEl)
      .setName("测试 LLM 连接")
      .setDesc("发送一条测试消息验证 API 配置")
      .addButton((btn) =>
        btn.setButtonText("测试").onClick(async () => {
          btn.setButtonText("测试中...");
          btn.setDisabled(true);
          try {
            const provider = this.plugin.llmProvider;
            if (!provider) throw new Error("请先配置 API Key");
            const reply = await provider.chat([
              { role: "user", content: "说一个字：好" },
            ]);
            btn.setButtonText("成功: " + reply.substring(0, 20));
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            btn.setButtonText("失败: " + msg.substring(0, 30));
          }
          setTimeout(() => {
            btn.setButtonText("测试");
            btn.setDisabled(false);
          }, 3000);
        })
      );

    // ─── Vault 路径 ───
    containerEl.createEl("h3", { text: "Vault 路径配置" });

    const pathSettings: { key: keyof ParaWavesSettings; label: string }[] = [
      { key: "inboxPath", label: "Inbox 路径" },
      { key: "projectsPath", label: "Projects 路径" },
      { key: "areasPath", label: "Areas 路径" },
      { key: "resourcesPath", label: "Resources 路径" },
      { key: "archivePath", label: "Archive 路径" },
      { key: "sparksPath", label: "Sparks 路径" },
      { key: "wikiPath", label: "LLM Wiki 路径" },
    ];

    for (const ps of pathSettings) {
      new Setting(containerEl)
        .setName(ps.label)
        .addText((text) =>
          text
            .setValue(this.plugin.settings[ps.key] as string)
            .onChange(async (value) => {
              (this.plugin.settings[ps.key] as string) = value;
              await this.plugin.saveSettings();
            })
        );
    }

    // ─── Sparks ───
    containerEl.createEl("h3", { text: "Sparks 灵感池" });

    new Setting(containerEl)
      .setName("🫧 过期天数")
      .setDesc("超过此天数未处理则标红")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.staleThresholdHatch))
          .onChange(async (value) => {
            this.plugin.settings.staleThresholdHatch = Number(value) || 3;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("🔥 过期天数")
      .setDesc("超过此天数未推进则标橙")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.staleThresholdIncubate))
          .onChange(async (value) => {
            this.plugin.settings.staleThresholdIncubate = Number(value) || 7;
            await this.plugin.saveSettings();
          })
      );

    // ─── 间隔重复 ───
    containerEl.createEl("h3", { text: "间隔重复" });

    new Setting(containerEl)
      .setName("默认难度因子")
      .setDesc("SM-2 初始 ease factor（建议 2.5）")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.defaultEaseFactor))
          .onChange(async (value) => {
            this.plugin.settings.defaultEaseFactor = Number(value) || 2.5;
            await this.plugin.saveSettings();
          })
      );

    // ─── 重置 ───
    containerEl.createEl("h3", { text: "重置" });

    new Setting(containerEl)
      .setName("恢复默认设置")
      .addButton((btn) =>
        btn.setButtonText("重置").onClick(async () => {
          this.plugin.settings = { ...DEFAULT_SETTINGS };
          await this.plugin.saveSettings();
          this.display();
        })
      );
  }
}
