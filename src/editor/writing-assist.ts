import { App, Editor, MarkdownView, Notice, TFile } from "obsidian";
import type { ParaWavesSettings } from "../types";
import type { LLMProvider } from "../llm/provider";

// ─── 整理笔记 ───

const FORMAT_SYSTEM = `你是笔记排版助手。重新排版用户给的笔记，让它更清晰。

规则：
1. 原封不动保留：frontmatter、[[]]双链、#标签、代码块（\`\`\`...\`\`\`）、行内代码、数学公式、图片链接、嵌入块
2. 保持原意，不增删内容，只调整排版格式
3. 用 ## 和 ### 组织层级
4. 用 **加粗** 标记关键词（少量，不要过度）
5. 并列信息用列表，结构化数据用表格
6. 适当使用 > [!callout] 包裹合适的内容（info/tip/warning/quote）
7. 中英文、中文与数字之间加空格
8. 直接输出排版后的完整笔记，不要解释`;

export async function formatNote(
  app: App,
  editor: Editor,
  view: MarkdownView,
  provider: LLMProvider
): Promise<string> {
  const file = view.file;
  if (!file) throw new Error("没有打开的文件");

  const content = editor.getValue();
  if (!content.trim()) throw new Error("笔记是空的");

  const result = await provider.chat(
    [{ role: "user", content: `请整理以下笔记的排版：\n\n${content}` }],
    FORMAT_SYSTEM,
    16384  // 排版需要完整输出，给充足 token 空间
  );

  if (!result || !result.trim()) throw new Error("LLM 返回为空");

  // 检测截断：如果原文比结果长很多且结果不以标点/空行结尾，可能被截断了
  if (result.length < content.length * 0.5 && !/[。！？\n]\s*$/.test(result.trim())) {
    throw new Error("笔记较长，排版结果可能被截断，请缩短笔记后重试");
  }

  if (result.trim() === content.trim()) return "unchanged";

  editor.setValue(result);
  return "ok";
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
  if (!file) throw new Error("没有打开的文件");

  const content = editor.getValue();
  if (!content.trim()) throw new Error("笔记是空的，先写点什么吧");

  // 获取光标位置之后的内容作为上下文
  const cursor = editor.getCursor();
  const beforeCursor = editor.getRange({ line: 0, ch: 0 }, cursor);
  const afterCursor = editor.getRange(cursor, { line: editor.lineCount(), ch: 0 });
  const fullContent = beforeCursor + (afterCursor ? `\n[...后续还有 ${afterCursor.length} 字]` : "");

  const result = await provider.chat(
    [{ role: "user", content: `我正在写这篇笔记，光标处停下来不知道怎么继续了。请帮我分析：\n\n${fullContent}` }],
    CONTINUE_SYSTEM
  );

  if (!result || !result.trim()) throw new Error("LLM 返回为空");

  // 在光标位置插入建议
  const suggestion = `\n\n> [!tip] 💡 写作建议\n> \n${result.split("\n").map((l: string) => `> ${l}`).join("\n")}\n\n`;
  editor.replaceRange(suggestion, cursor);
}

// ─── 写作助手（右键菜单）───

/** 对选中文字调用 LLM，替换选中内容 */
async function transformSelection(
  editor: Editor,
  provider: LLMProvider,
  action: string,
  systemPrompt: string
): Promise<void> {
  const selected = editor.getSelection();
  if (!selected.trim()) throw new Error("请先选中文字");

  const result = await provider.chat(
    [{ role: "user", content: `${action}：\n\n${selected}` }],
    systemPrompt
  );

  if (!result || !result.trim()) throw new Error("LLM 返回为空");
  editor.replaceSelection(result);
}

const POLISH_SYSTEM = `你是文字润色助手。优化用户给的文字，让它更流畅、更清晰、更有表达力。
要求：
1. 保持原意不变
2. 修正语法和用词错误
3. 改善句式结构，消除啰嗦重复
4. 不改变原文风格（口语保持口语，书面保持书面）
5. 直接输出润色后的文字，不要解释`;

const EXPAND_SYSTEM = `你是文字扩写助手。将用户给的文字扩展得更丰富、更详细。
要求：
1. 保持原意和核心观点
2. 补充细节、例子、论述
3. 扩写到原文的 2-3 倍长度
4. 保持原文风格一致
5. 直接输出扩写后的文字，不要解释`;

const CONDENSE_SYSTEM = `你是文字缩写助手。将用户给的文字精简为更简洁的版本。
要求：
1. 保留所有核心观点和信息
2. 删除冗余、重复、啰嗦的部分
3. 缩写到原文的 1/2 到 1/3 长度
4. 保持逻辑完整
5. 直接输出缩写后的文字，不要解释`;

const STYLE_MAP: Record<string, string> = {
  "学术": `你是学术写作助手。将用户给的文字改写为学术论文风格。
要求：用词严谨、表述客观、逻辑清晰、避免口语化、适当使用专业术语。直接输出，不要解释。`,
  "口语": `你是口语化写作助手。将用户给的文字改写为轻松自然的口语风格。
要求：像跟朋友聊天一样、短句为主、通俗易懂、可以适当加语气词。直接输出，不要解释。`,
  "正式": `你是正式文书写作助手。将用户给的文字改写为正式商务/公文风格。
要求：措辞得体、格式规范、表述清晰、避免口语和网络用语。直接输出，不要解释。`,
  "营销文案": `你是营销文案写作助手。将用户给的文字改写为吸引人的营销文案。
要求：有吸引力、突出卖点、使用感性和理性的混合说服、适当使用短句和排比增强节奏。直接输出，不要解释。`,
  "技术文档": `你是技术文档写作助手。将用户给的文字改写为清晰的技术文档风格。
要求：结构清晰、用词精准、步骤明确、适当使用代码示例和列表。直接输出，不要解释。`,
};

export async function polishText(editor: Editor, provider: LLMProvider): Promise<void> {
  await transformSelection(editor, provider, "请润色以下文字", POLISH_SYSTEM);
}

export async function expandText(editor: Editor, provider: LLMProvider): Promise<void> {
  await transformSelection(editor, provider, "请扩写以下文字", EXPAND_SYSTEM);
}

export async function condenseText(editor: Editor, provider: LLMProvider): Promise<void> {
  await transformSelection(editor, provider, "请缩写以下文字", CONDENSE_SYSTEM);
}

export async function rewriteStyle(editor: Editor, provider: LLMProvider, style: string): Promise<void> {
  const systemPrompt = STYLE_MAP[style];
  if (!systemPrompt) throw new Error(`未知风格: ${style}`);
  await transformSelection(editor, provider, `请改写为${style}风格`, systemPrompt);
}

export const AVAILABLE_STYLES = Object.keys(STYLE_MAP);
