import { App, Editor, FuzzySuggestModal, Notice } from "obsidian";
import type { LLMProvider } from "../llm/provider";
import { rewriteStyle, AVAILABLE_STYLES } from "./writing-assist";

export class StylePickerModal extends FuzzySuggestModal<string> {
  constructor(app: App, private provider: LLMProvider, private editor: Editor) {
    super(app);
    this.setPlaceholder("选择写作风格...");
  }

  getItems(): string[] {
    return AVAILABLE_STYLES;
  }

  getItemText(item: string): string {
    return item;
  }

  async onChooseItem(style: string): Promise<void> {
    try {
      new Notice(`正在改写为${style}风格...`);
      await rewriteStyle(this.editor, this.provider, style);
      new Notice(`已改写为${style}风格`);
    } catch (e) {
      new Notice(`改写失败: ${(e instanceof Error ? e.message : String(e)).substring(0, 80)}`);
    }
  }
}
