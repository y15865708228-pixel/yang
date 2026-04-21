import { App, Editor, MarkdownView, Notice, TFile } from "obsidian";
import type { ParaWavesSettings } from "../types";
import type { LLMProvider } from "../llm/provider";

// ─── 整理笔记 ───

const FORMAT_SYSTEM = `你是 Pensea 笔记排版助手。用户给你一篇笔记，你需要重新排版让它更清晰美观。

规则：
1. 保留 frontmatter（---之间的内容）原封不动
2. 保留所有 [[]] 双链和标签不变
3. 保持原意，不要增删内容，只调整结构
4. 使用 Obsidian markdown 特性：
   - 用 ## 和 ### 组织层级
   - 用 > [!callout] 语法（info/tip/quote/abstract/warning）包裹合适的内容
   - 用 *** 作为分隔线
   - 用 **加粗** 标记关键词
   - 用列表和表格整理信息
5. 保留所有用户写的中文内容，只改排版格式
6. 直接输出排版后的完整笔记，不要解释`;

export async function formatNote(
  app: App,
  editor: Editor,
  view: MarkdownView,
  provider: LLMProvider
): Promise<void> {
  const file = view.file;
  if (!file) { new Notice("没有打开的文件"); return; }

  const content = editor.getValue();
  if (!content.trim()) { new Notice("笔记是空的"); return; }

  new Notice("正在整理排版...");

  try {
    const result = await provider.chat(
      [{ role: "user", content: `请整理以下笔记的排版：\n\n${content}` }],
      FORMAT_SYSTEM
    );

    if (!result || !result.trim()) {
      new Notice("整理失败：LLM 返回为空");
      return;
    }

    editor.setValue(result);
    new Notice("排版整理完成");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(`整理失败: ${msg.substring(0, 80)}`);
  }
}

// ─── 继续写 ───

const CONTINUE_SYSTEM = `你是 Pensea 写作助手。用户正在写一篇笔记，写到一半不知道怎么继续。

你需要：
1. 分析笔记类型（从 frontmatter 的 type 字段判断）
2. 看用户已经写了什么，判断笔记的完成度
3. 给出具体的写作建议——下一步该写什么、怎么写

按以下结构回复，直接输出内容，不要用代码块包裹：

📋 当前完成度：XX%
💡 建议下一步：
- [具体建议1]
- [具体建议2]

✍️ 参考续写：
（根据上下文续写 3-5 句，用户可以参考或直接使用）`;

export async function continueWriting(
  app: App,
  editor: Editor,
  view: MarkdownView,
  provider: LLMProvider
): Promise<void> {
  const file = view.file;
  if (!file) { new Notice("没有打开的文件"); return; }

  const content = editor.getValue();
  if (!content.trim()) { new Notice("笔记是空的，先写点什么吧"); return; }

  // 获取光标位置之后的内容作为上下文
  const cursor = editor.getCursor();
  const beforeCursor = editor.getRange({ line: 0, ch: 0 }, cursor);
  const afterCursor = editor.getRange(cursor, { line: editor.lineCount(), ch: 0 });
  const fullContent = beforeCursor + (afterCursor ? `\n[...后续还有 ${afterCursor.length} 字]` : "");

  new Notice("正在分析...");

  try {
    const result = await provider.chat(
      [{ role: "user", content: `我正在写这篇笔记，光标处停下来不知道怎么继续了。请帮我分析：\n\n${fullContent}` }],
      CONTINUE_SYSTEM
    );

    if (!result || !result.trim()) {
      new Notice("分析失败：LLM 返回为空");
      return;
    }

    // 在光标位置插入建议
    const suggestion = `\n\n> [!tip] 💡 写作建议\n> \n${result.split("\n").map((l: string) => `> ${l}`).join("\n")}\n\n`;
    editor.replaceRange(suggestion, cursor);
    new Notice("写作建议已插入，满意后可以删除建议块");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(`分析失败: ${msg.substring(0, 80)}`);
  }
}
