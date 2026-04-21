import { App, Notice, TFile, normalizePath } from "obsidian";
import type { LLMProvider } from "../llm/provider";

const TITLE_SYSTEM = `你是一个文件命名助手。根据笔记内容生成一个简短的中文文件名。

规则：
1. 不超过 20 个字
2. 只返回文件名，不要引号、不要解释、不要标点符号
3. 用中文，必要时可夹带英文缩写
4. 概括核心内容，不要用"关于""对于"等空洞词`;

// 判断是否为默认/无意义文件名
function isGenericName(basename: string): boolean {
	if (!basename) return true;
	// Obsidian 默认命名
	if (/^untitled/i.test(basename)) return true;
	// 纯数字、纯日期（日记交给模板处理）
	if (/^\d{4}-\d{2}-\d{2}$/.test(basename)) return false; // 日记不自动改名
	if (/^\d+$/.test(basename)) return true;
	// 很短的随机名
	if (basename.length <= 2) return true;
	return false;
}

// 清理文件名中的非法字符
function sanitizeName(name: string): string {
	return name
		.replace(/[/\\?%*:|"<>\n\r]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.substring(0, 50);
}

export async function autoTitleFile(
	app: App,
	file: TFile,
	provider: LLMProvider
): Promise<string | null> {
	const content = await app.vault.read(file);
	const trimmed = content.replace(/^---[\s\S]*?---/, "").trim(); // 去掉 frontmatter

	if (trimmed.length < 20) return null; // 内容太少，不命名

	try {
		const title = await provider.chat(
			[{ role: "user", content: `请为以下笔记内容生成一个文件名：\n\n${trimmed.substring(0, 1000)}` }],
			TITLE_SYSTEM
		);

		const clean = sanitizeName(title);
		if (!clean || clean === sanitizeName(file.basename)) return null;

		const newPath = normalizePath(`${file.parent?.path ? file.parent.path + "/" : ""}${clean}.md`);
		if (app.vault.getAbstractFileByPath(newPath)) return null; // 已存在同名文件

		await app.fileManager.renameFile(file, newPath);
		return clean;
	} catch {
		return null;
	}
}

export { isGenericName };
