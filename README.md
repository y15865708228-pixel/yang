# Pensea（思海）

> 打开就做，不胡思乱想

[中文](#中文) | [English](#english)

---

<a id="中文"></a>

## 你是不是也这样

打开 Obsidian，盯着空白的日记发呆。翻翻昨天的笔记，觉得该整理。又看看收藏夹，太多没分类的东西。想着想着，半小时过去了。

不是没想法，是**想法太多，没有一个能落地**。

不是不努力，是**每天打开软件都不知道先做什么**。

Pensea 解决的核心问题就一个：**打开就知道做什么，做完就知道下一步**。

---

## 功能介绍

### 打开就有方向

侧边栏看板，一眼看到今天该做什么：几条灵感待处理、几张卡片该复习、Inbox 里还有多少没归档。不用想，按顺序做就行。

### 想法不会烂在草稿里

灵感有清晰的生命周期：🫧 待孵化 → 🔥 孵化中 → ✅ 准备好 → 立项。放着不管会变红提醒你。选中任意文字右键就能创建灵感卡片。

### 知识不再写了就忘

SM-2 间隔重复算法自动排复习。写过的东西会按时回来找你，直到真正记住。

### Inbox 不用自己整理

AI 读取 Inbox，自动分类、生成摘要、写入知识库。扔进去就行，剩下的交给 Pensea。

### 笔记之间不再孤立

对知识库直接提问，AI 检索相关页面综合回答。还能自动检测矛盾、孤儿页面、过时信息。

### 日记、周报、归档一条龙

月历视图管理日记，周报自动汇总，月度归档合并旧日记并迁移未完成任务。

### 智能命名

新建笔记写完内容后，AI 自动根据内容生成文件名。不用再想"这篇笔记该叫什么"。

### 不想开 AI 也能用

看板、日历、复习、周报、归档全部离线可用。LLM 功能是可选增强。

---

## 安装

### 从 Obsidian 社区插件安装

在 Obsidian 中打开「设置 → 第三方插件」。首次使用第三方插件时，按提示关闭受限模式。点击「浏览」，搜索 **Pensea**，然后安装并启用。[Pensea 社区插件页](https://community.obsidian.md/plugins/pensea)

### 手动安装

1. 打开[最新版发布页](https://github.com/y15865708228-pixel/yang/releases/latest)，从同一版本的 **Assets** 分别下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 在仓库中创建 `.obsidian/plugins/pensea/`，把这三个文件直接放入该目录。
3. 重启 Obsidian，在「设置 → 第三方插件」中启用 **Pensea**。

### BRAT 安装

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. BRAT 设置 → Add Beta Plugin → 输入仓库地址 `https://github.com/y15865708228-pixel/yang`
3. 安装完成后启用 Pensea

### 可选的 Pensea 主题

插件可以搭配你当前的主题使用。如果喜欢配套外观，在「设置 → 外观 → 主题 → 管理」中搜索 **Pensea**。[社区主题页](https://community.obsidian.md/themes/pensea)

---

## 使用手册

### 第一步：初始化 Vault

安装后在命令面板（`Ctrl/Cmd + P`）中搜索并执行：

```
Pensea: 初始化 Vault 结构
```

会自动创建以下目录和模板：

```
你的 Vault/
├── 0-Inbox/          → 所有想法先进这里
├── 1-Projects/       → 有明确目标的项目
├── 2-Areas/          → 长期负责的领域
├── 3-Resources/      → 参考资料
│   └── LLM-Wiki/     → AI 维护的知识库
├── 4-Archive/        → 已完成的内容
├── Sparks/           → 灵感卡片
├── Daily/            → 每日笔记
├── Templates/        → 模板
└── Tasks/            → 任务
```

### 第二步：打开看板

在命令面板执行 `Pensea: 打开 Sparks 看板`。在 Sparks 输入框写下第一条灵感并按回车，然后点击欢迎卡上的「开始使用 ✓」。这一步可以离线完成。

看板包含：
- **统计卡片**：Inbox 数量、灵感总数、待复习卡片、Wiki 页面数
- **快捷操作**：处理 Inbox、复习卡片、健康检查、周报、排版整理、续写
- **灵感看板**：按状态分组显示所有灵感，支持流转和右键菜单
- **今日概览**：月历 + 今日任务进度
- **每日宣言**：每日一条易经卦辞

### 第三步：配置 LLM（可选）

设置 → Pensea → LLM 配置：

1. **选择提供商**：下拉菜单选择，自动填充地址和模型
2. **填入 API Key**，确认 API 地址指向你要使用的服务。
3. **点击测试**，插件会向该地址发送密钥和一条固定的测试消息。

支持的提供商：

| 提供商 | 说明 |
|--------|------|
| OpenAI | GPT-4o-mini / GPT-4o 等 |
| DeepSeek | 国产，性价比高 |
| Kimi（月之暗面） | 长文本能力强 |
| MiniMax | 国产 |
| GLM（智谱） | ChatGLM 系列 |
| Ollama | 本地部署，免费 |
| Claude（Anthropic） | 需单独配置 |
| Gemini（Google） | 需单独配置 |
| 自定义 | 填入任意 OpenAI 兼容地址 |

不配置 LLM 也可以使用：看板、日历、复习、周报、归档全部离线运行。

### 日常使用流程

**每天打开 Obsidian 时：**

1. 看一眼侧边栏看板 → 知道今天有什么要做
2. 处理红色高亮的过期灵感 → 决定继续还是放弃
3. 如果有到期复习卡片 → 点"复习卡片"开始复习
4. 点月历上的今天 → 打开日记，开始记录

**有新想法时：**

- 方式 1：看板顶部输入框，直接输入，回车创建灵感
- 方式 2：在任意笔记中选中文字 → 右键 → "转为灵感"

**灵感孵化完成后：**

- 点灵感右侧的箭头按钮流转到下一阶段
- ✅ 准备好的灵感可以点"立项"直接创建项目

**需要整理笔记时：**

- 打开笔记 → 命令面板 → `Pensea: 整理笔记排版`
- 或 → `Pensea: 继续写`，AI 帮你分析并给出续写建议

**Inbox 堆积时：**

- 看板点"处理 Inbox"，AI 自动分类归档
- 或把文件扔进 `0-Inbox/` 文件夹，等有空再批量处理

**想查知识库时：**

- 命令面板 → `Pensea: Wiki: 提问`
- 在对话框中输入问题，AI 从知识库中检索并回答
- 回答中的 `[[双链]]` 可以直接点击跳转

---

## 命令一览

| 命令 | 说明 | 需要 LLM |
|------|------|----------|
| `初始化 Vault 结构` | 创建 PARA 目录 + 模板 | 否 |
| `打开 Sparks 看板` | 侧边栏看板 | 否 |
| `测试 LLM 连接` | 验证 API 配置 | 是 |
| `复习到期卡片` | 间隔重复复习 | 否 |
| `Wiki: 处理 Inbox` | AI 归档 Inbox | 是 |
| `Wiki: 提问` | 对知识库问答 | 是 |
| `Wiki: 健康检查` | 检测知识库问题 | 是 |
| `重建 Embedding 索引` | 语义搜索索引 | 是 |
| `整理笔记排版` | AI 整理排版 | 是 |
| `继续写` | AI 续写 | 是 |
| `智能命名当前笔记` | AI 生成文件名 | 是 |
| `生成本周回顾` | 自动周报 | 否 |
| `归档上月日记` | 合并归档 | 否 |

---

## 常见问题

**Q：不配置 AI 能用吗？**
A：可以。看板、日历、复习、周报、归档全部离线可用。AI 功能（Inbox 处理、Wiki 问答、排版、续写）是可选增强。

**Q：推荐用哪个 AI 提供商？**
A：DeepSeek 性价比最高，国内直连无需翻墙。Ollama 完全免费但需要本地部署。OpenAI 效果最好但需翻墙。

**配置 AI 后，密钥和笔记会发到哪里？**

Pensea 将密钥保存在当前仓库的插件设置中。每次 AI 请求都会向配置的 API 地址发送密钥。OpenAI 兼容服务通过 `Authorization` 请求头认证，Claude 聊天通过 `x-api-key` 请求头认证，Gemini 通过 URL 的 `key` 参数认证。

使用 OpenAI 兼容服务或 Claude 聊天时，可以单独指定向量服务的地址。若向量密钥留空，插件会将聊天密钥发到该地址。Gemini 向量请求使用聊天地址和密钥。Wiki 问答使用语义检索时，向量服务也会收到你的问题。

| 功能 | 发送的内容 |
|------|------------|
| 排版、续写、选区改写 | 排版发送整篇笔记，续写发送光标前的文字及光标后的字数，润色等选区操作发送选中文字。 |
| 处理 Inbox | 逐篇发送要归档的 Markdown 笔记全文。 |
| Wiki 问答、健康检查 | 问答发送问题，并在有检索结果时附上索引摘录、相关页标题和摘录。健康检查发送 Wiki 页面的路径和摘录。 |
| 智能命名 | 发送笔记正文开头最多 1,000 个字符。插件启动时已配置 AI 的情况下，编辑 `Untitled` 等默认名称的笔记也可能自动触发命名。 |
| Wiki 向量索引 | 发送每个待索引页面的正文开头最多 800 个字符，正文为空时发送文件名。创建或编辑 Wiki 页面也可能自动触发索引更新。 |

**Q：数据存在哪里？**
A：笔记以 Markdown 文件保存在仓库中，复习记录保存在插件数据中。API Key 留空时，看板、灵感和复习等功能都在本地运行。

**Q：支持手机端吗？**
A：支持。已做移动端适配（响应式布局 + 长按菜单）。将插件文件复制到手机端 Obsidian 的 `.obsidian/plugins/pensea/` 目录即可。

---

## 开发

```bash
git clone https://github.com/y15865708228-pixel/yang.git
cd yang
npm install
npm run dev    # 开发模式（热重载）
npm run build  # 生产构建
```

## License

MIT

---

<a id="english"></a>

# Pensea

> Open it and know what to do. No more overthinking.

[中文](#中文) | [English](#english)

---

## You know the feeling

You open Obsidian and stare at a blank daily note. You scroll through yesterday's notes, think about organizing. You check your bookmarks — too many unsorted items. Before you know it, 30 minutes are gone.

It's not a lack of ideas — **it's too many ideas, none of them landing**.

It's not laziness — **it's opening the app every day without knowing where to start**.

Pensea solves one core problem: **open it and know exactly what to do next**.

---

## Features

### Direction at a glance

The sidebar kanban shows everything that needs attention: ideas to process, flashcards to review, inbox items to archive. No thinking required — just work through the list.

### Ideas don't rot in drafts

Every idea has a clear lifecycle: 🫧 Hatch → 🔥 Incubate → ✅ Ready → Project. Stale ideas turn red. Right-click any text to create a spark card instantly.

### Knowledge sticks

SM-2 spaced repetition brings notes back at the right time, until you truly remember them.

### Inbox sorts itself

AI reads your inbox, classifies notes, writes summaries, and files them into the knowledge base. Just drop things in.

### Notes connect to each other

Ask questions against your knowledge base — AI retrieves relevant pages and synthesizes answers. Detects contradictions, orphan pages, and stale claims automatically.

### Journal, weekly reports, archival — handled

Monthly calendar with lunar dates for daily notes. Auto-generated weekly summaries. Monthly archival merges old journals and migrates unfinished tasks.

### Smart naming

New notes get auto-named by AI based on content. No more staring at "Untitled" files.

### Works without AI

Kanban, calendar, review, reports, archival — all offline. LLM features are optional enhancements.

### Mobile support

Responsive layout adapts to phone screens. Long-press replaces right-click menus. Works on Obsidian mobile.

### User guide included

Running `Pensea: 初始化 Vault 结构` creates a built-in user guide at `3-Resources/Pensea 使用手册.md`.

---

## Install

### From Obsidian Community plugins

Open **Settings → Community plugins**. If this is your first community plugin, follow the prompt to turn off Restricted mode. Select **Browse**, search for **Pensea**, then select **Install** and **Enable**. [Pensea community plugin page](https://community.obsidian.md/plugins/pensea)

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from **Assets** on the [latest release](https://github.com/y15865708228-pixel/yang/releases/latest).
2. Create `.obsidian/plugins/pensea/` in your vault and put all three files directly in that folder.
3. Restart Obsidian and enable **Pensea** under **Settings → Community plugins**.

### BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add Beta Plugin → `https://github.com/y15865708228-pixel/yang`
3. Enable Pensea

### Optional Pensea theme

The plugin works with your current theme. For the companion theme, search for **Pensea** under **Settings → Appearance → Themes → Manage**. [Community theme page](https://community.obsidian.md/themes/pensea)

---

## Quick Start

1. **Initialize**: Command palette (`Ctrl/Cmd + P`) → `Pensea: 初始化 Vault 结构`
2. Run `Pensea: 打开 Sparks 看板` to open the board. Type your first idea in the Sparks field and press Enter. Select **开始使用 ✓** on the welcome card. This works offline.
3. To use AI, choose your provider under **Settings → Pensea**, check the API address, and enter its key. Testing the connection sends the key and a fixed test message to that address.

Supported providers: OpenAI · DeepSeek · Kimi · MiniMax · GLM · Ollama · Claude · Gemini · Custom

All core features work offline without LLM configuration.

---

## FAQ

**Q: Does it work without AI?**
A: Yes. Kanban, calendar, spaced repetition, weekly reports, archival all work offline.

**Q: Which AI provider do you recommend?**
A: DeepSeek for best value. Ollama for free local use. OpenAI for best quality.

**Where do my key and notes go when I use AI?**

Pensea stores keys in the plugin settings in your vault. Each AI request sends a key to the configured API address. OpenAI-compatible services use the `Authorization` header, Claude chat uses the `x-api-key` header, and Gemini uses the `key` query parameter in the URL.

With an OpenAI-compatible or Claude chat provider, you can set a separate embedding endpoint. Leaving its key blank sends your chat key to that endpoint. Gemini uses the chat endpoint and key for embeddings. When Wiki Q&A uses semantic search, the embedding service also receives your question.

| Feature | Content sent |
|---------|--------------|
| Writing tools | Formatting sends the whole note. Continue writing sends the text before the cursor and the number of characters after it. Selection tools such as polish send the selected text. |
| Process Inbox | The full text of each Markdown note being processed. |
| Wiki Q&A and health check | Q&A sends your question and, when pages are found, an index excerpt and relevant page titles and excerpts. The health check sends Wiki page paths and excerpts. |
| Smart naming | Up to the first 1,000 characters of the note body. If AI is configured when the plugin loads, editing a note with a generic name such as `Untitled` can trigger this automatically. |
| Wiki embedding index | Up to the first 800 characters of each indexed page body, or the filename if the excerpt is empty. Creating or editing a Wiki page can trigger an index update automatically. |

**Q: Does it work on mobile?**
A: Yes. Responsive layout with long-press support. Copy plugin files to your mobile vault's `.obsidian/plugins/pensea/` directory.

---

## Development

```bash
git clone https://github.com/y15865708228-pixel/yang.git
cd yang
npm install
npm run dev
npm run build
```

## License

MIT
