import { App, Modal } from "obsidian";
import type { ParaWavesSettings } from "../types";
import type { LLMProvider } from "../llm/provider";
import { queryWiki, saveQueryAsWiki } from "./query";

export class WikiChatModal extends Modal {
  private provider: LLMProvider;
  private settings: ParaWavesSettings;
  private messages: { role: string; content: string }[] = [];

  constructor(app: App, settings: ParaWavesSettings, provider: LLMProvider) {
    super(app);
    this.settings = settings;
    this.provider = provider;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pw-wiki-chat");

    this.titleEl.textContent = "Wiki 问答";

    // 消息区
    const msgContainer = contentEl.createDiv({ cls: "messages" });
    this.renderMessage(msgContainer, "assistant", "你好！我是 waves 知识库助手。请问你想了解什么？");

    // 输入区
    const inputRow = contentEl.createDiv({ cls: "input-row" });
    const input = inputRow.createEl("input", {
      type: "text",
      placeholder: "输入你的问题...",
    });
    input.style.cssText = "flex:1;";

    const sendBtn = inputRow.createEl("button", { text: "发送", cls: "mod-cta" });

    const sendMessage = async () => {
      const question = input.value.trim();
      if (!question) return;

      input.value = "";
      this.renderMessage(msgContainer, "user", question);

      // 添加加载提示
      const loadingEl = this.renderMessage(msgContainer, "assistant", "思考中...");

      try {
        const answer = await queryWiki(this.app, this.settings, this.provider, question);
        loadingEl.textContent = "";

        // 渲染 markdown 内容（简化处理：保留 [[双链]] 格式）
        const lines = answer.split("\n");
        for (const line of lines) {
          const p = loadingEl.createEl("p");
          p.textContent = line;
          // 高亮 [[双链]]
          const linked = line.match(/\[\[([^\]]+)\]\]/g);
          if (linked) {
            p.empty();
            let remaining = line;
            for (const link of linked) {
              const idx = remaining.indexOf(link);
              if (idx > 0) p.appendChild(document.createTextNode(remaining.substring(0, idx)));
              const linkEl = p.createEl("a", {
                cls: "internal-link",
                text: link,
              });
              linkEl.addEventListener("click", () => {
                const target = link.replace("[[", "").replace("]]", "");
                this.app.workspace.openLinkText(target, "", false);
              });
              remaining = remaining.substring(idx + link.length);
            }
            if (remaining) p.appendChild(document.createTextNode(remaining));
          }
        }

        this.messages.push({ role: "user", content: question });
        this.messages.push({ role: "assistant", content: answer });

        // 保存按钮
        const saveBtn = loadingEl.createEl("button", {
          text: "保存为 Wiki 页面",
          cls: "mod-muted",
        });
        saveBtn.style.cssText = "margin-top:8px;font-size:0.8em;";
        saveBtn.addEventListener("click", async () => {
          const path = await saveQueryAsWiki(this.app, this.settings, question, answer);
          if (path) {
            saveBtn.textContent = "已保存 ✓";
            saveBtn.disabled = true;
          }
        });

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        loadingEl.textContent = `错误: ${msg}`;
        loadingEl.style.color = "#e74c3c";
      }

      msgContainer.scrollTop = msgContainer.scrollHeight;
    };

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    input.focus();
  }

  private renderMessage(container: HTMLElement, role: "user" | "assistant", text: string): HTMLElement {
    const msgEl = container.createDiv({ cls: `message ${role}` });
    msgEl.textContent = text;
    container.scrollTop = container.scrollHeight;
    return msgEl;
  }
}
