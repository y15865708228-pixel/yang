import { App, PluginSettingTab, Setting, TextComponent } from "obsidian";
import type ParaWavesPlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";
import type { ParaWavesSettings } from "./types";
import { sameApiOrigin } from "./llm/provider";

const PROVIDERS = [
  { name: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { name: "Kimi (Moonshot)", baseURL: "https://api.moonshot.cn/v1", model: "moonshot-v1-auto" },
  { name: "MiniMax", baseURL: "https://api.minimax.chat/v1", model: "MiniMax-Text-01" },
  { name: "GLM Coding Plan (套餐)", baseURL: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-5.2" },
  { name: "GLM (Zhipu 按量计费)", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { name: "Ollama (本地)", baseURL: "http://localhost:11434/v1", model: "qwen2.5:7b" },
  { name: "Claude (Anthropic)", baseURL: "https://api.anthropic.com", model: "claude-sonnet-4-20250514" },
  { name: "Gemini (Google)", baseURL: "https://generativelanguage.googleapis.com", model: "gemini-2.0-flash" },
  { name: "自定义", baseURL: "", model: "" },
] as const;

const EMBEDDING_MODELS = [
  { id: "embedding-3", label: "智谱 GLM · embedding-3 (2048d) — 推荐国产", baseURL: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "text-embedding-v3", label: "通义千问 · text-embedding-v3 (1024d) — 阿里 DashScope", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "text-embedding-v1", label: "Kimi (Moonshot) · text-embedding-v1 (1024d)", baseURL: "https://api.moonshot.cn/v1" },
  { id: "embo-01", label: "MiniMax · embo-01 (1024d)", baseURL: "https://api.minimax.chat/v1" },
  { id: "text-embedding-3-small", label: "OpenAI · text-embedding-3-small (1536d) — 国际通用", baseURL: "https://api.openai.com/v1" },
  { id: "text-embedding-3-large", label: "OpenAI · text-embedding-3-large (3072d) — 贵但准", baseURL: "https://api.openai.com/v1" },
  { id: "text-embedding-004", label: "Gemini · text-embedding-004 (768d) — Google", baseURL: "" },
  { id: "bge-m3", label: "Ollama · bge-m3 (1024d) — 中文最强、本地免费", baseURL: "http://localhost:11434/v1" },
  { id: "bge-large-zh-v1.5", label: "Ollama · bge-large-zh-v1.5 (1024d) — 中文专用", baseURL: "http://localhost:11434/v1" },
  { id: "nomic-embed-text", label: "Ollama · nomic-embed-text (768d) — 轻量英文", baseURL: "http://localhost:11434/v1" },
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

    const config = this.plugin.settings.llm;
    let chatKeyText: TextComponent | undefined;
    let keyTextRef: TextComponent | undefined;
    const setChatAddress = (address: string) => {
      if (address !== config.baseURL && !sameApiOrigin(config.baseURL, address)) {
        config.apiKey = "";
        chatKeyText?.setValue("");
        if (!config.embeddingBaseURL) {
          config.embeddingApiKey = undefined;
          keyTextRef?.setValue("");
        }
      }
      config.baseURL = address;
    };

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
          setChatAddress(preset.baseURL);
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
      .setDesc("更改协议、主机或端口后，请填写新服务的密钥")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.llm.baseURL)
          .onChange(async (value) => {
            setChatAddress(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("你的 API 密钥")
      .addText((text) => {
        chatKeyText = text;
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
      text: "推荐：智谱 GLM 用户选 embedding-3，Ollama 本地选 bge-m3。Kimi / Claude 不提供 Embedding API，需在下方填独立地址和 Key（可指向 OpenAI / GLM / 通义 等任意 OpenAI 兼容服务）。",
      cls: "setting-item-description",
    });

    const embModelSetting = new Setting(containerEl)
      .setName("Embedding 模型")
      .setDesc("下拉选常用模型会自动填充下方 API 地址；选「自定义」后可在右侧文本框手动填写任意模型名");

    let modelTextRef: TextComponent | undefined;
    let urlTextRef: TextComponent | undefined;
    const setEmbeddingAddress = (address: string) => {
      const oldAddress = config.embeddingBaseURL || config.baseURL;
      const newAddress = address || config.baseURL;
      if (oldAddress !== newAddress && !sameApiOrigin(oldAddress, newAddress)) {
        config.embeddingApiKey = undefined;
        keyTextRef?.setValue("");
      }
      config.embeddingBaseURL = address || undefined;
    };

    embModelSetting.addDropdown((dd) => {
      dd.addOption("", "— 选择常用模型 —");
      EMBEDDING_MODELS.forEach((m) => dd.addOption(m.id, m.label));
      dd.addOption("__custom__", "自定义…");
      const current = this.plugin.settings.llm.embeddingModel ?? "";
      const isKnown = (EMBEDDING_MODELS as readonly { id: string }[]).some((m) => m.id === current);
      dd.setValue(current === "" ? "" : isKnown ? current : "__custom__");
      dd.onChange(async (value) => {
        if (value === "__custom__") return;
        const selected = (EMBEDDING_MODELS as readonly { id: string; baseURL: string }[]).find((m) => m.id === value);
        this.plugin.settings.llm.embeddingModel = value;
        if (selected) {
          setEmbeddingAddress(selected.baseURL);
          urlTextRef?.setValue(selected.baseURL);
        }
        await this.plugin.saveSettings();
        modelTextRef?.setValue(value);
      });
    });

    embModelSetting.addText((modelText) => {
      modelTextRef = modelText;
      modelText
        .setPlaceholder("模型名（选自定义时填写）")
        .setValue(this.plugin.settings.llm.embeddingModel ?? "")
        .onChange(async (value) => {
          this.plugin.settings.llm.embeddingModel = value;
          await this.plugin.saveSettings();
        });
    });

    new Setting(containerEl)
      .setName("Embedding API 地址")
      .setDesc("OpenAI 兼容服务可留空以使用 Chat 地址；Claude 需要独立的向量地址。Gemini 使用 Chat 地址。")
      .addText((urlText) => {
        urlTextRef = urlText;
        urlText
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.llm.embeddingBaseURL ?? "")
          .onChange(async (value) => {
            setEmbeddingAddress(value);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Embedding API Key")
      .setDesc("协议、主机和端口均与 Chat 相同时，留空可复用聊天密钥。其他云端地址需填写专用密钥，本机回环地址可免认证。")
      .addText((keyText) => {
        keyTextRef = keyText;
        keyText.inputEl.type = "password";
        keyText
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.llm.embeddingApiKey ?? "")
          .onChange(async (value) => {
            this.plugin.settings.llm.embeddingApiKey = value || undefined;
            await this.plugin.saveSettings();
          });
      });

    // ─── 测试 Embedding 连接 ───
    new Setting(containerEl)
      .setName("测试 Embedding 连接")
      .setDesc("发送一段测试文本，验证 Embedding 模型、地址、Key 是否可用")
      .addButton((btn) =>
        btn.setButtonText("测试").onClick(async () => {
          btn.setButtonText("测试中...");
          btn.setDisabled(true);
          try {
            const provider = this.plugin.llmProvider;
            if (!provider) throw new Error("请先在顶部配置 Chat API Key");
            const vectors = await provider.embed(["测试中文向量化"]);
            if (vectors.length > 0 && vectors[0].length > 0) {
              btn.setButtonText(`成功: ${vectors[0].length} 维向量`);
            } else {
              btn.setButtonText("失败: 返回为空");
            }
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

    // ─── 测试 Chat 连接 ───
    new Setting(containerEl)
      .setName("测试 Chat 连接")
      .setDesc("发送一条测试消息验证 Chat API 配置（不影响 Embedding）")
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
          Object.assign(this.plugin.settings, DEFAULT_SETTINGS, { llm: { ...DEFAULT_SETTINGS.llm } });
          await this.plugin.saveSettings();
          this.display();
        })
      );
  }
}
