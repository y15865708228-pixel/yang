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

### 手动安装

1. 从 [Releases](../../releases) 下载最新版 `release.zip`
2. 解压，得到 `main.js`、`manifest.json`、`styles.css`、`versions.json` 四个文件
3. 在你的 Obsidian Vault 中找到 `.obsidian/plugins/` 目录
4. 新建文件夹 `pensea`，把四个文件放进去
5. 重启 Obsidian → 设置 → 社区插件 → 找到 **Pensea** → 开启

### BRAT 安装

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. BRAT 设置 → Add Beta Plugin → 输入仓库地址 `https://github.com/y15865708228-pixel/yang`
3. 安装完成后启用 Pensea

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

点击左侧边栏的 ✨ 图标，或命令面板执行 `Pensea: 打开 Sparks 看板`。

看板包含：
- **统计卡片**：Inbox 数量、灵感总数、待复习卡片、Wiki 页面数
- **快捷操作**：处理 Inbox、复习卡片、健康检查、周报、排版整理、续写
- **灵感看板**：按状态分组显示所有灵感，支持流转和右键菜单
- **今日概览**：月历 + 今日任务进度
- **每日宣言**：每日一条易经卦辞

### 第三步：配置 LLM（可选）

设置 → Pensea → LLM 配置：

1. **选择提供商**：下拉菜单选择，自动填充地址和模型
2. **填入 API Key**：密钥仅保存在本地，不会上传
3. **点击测试**：确认连接成功

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

**Q：API Key 安全吗？**
A：密钥仅保存在你本地的 Obsidian 插件配置中，不会发送到任何第三方服务器。

**Q：数据存在哪里？**
A：所有数据都在你的 Vault 里——笔记是 Markdown 文件，复习记录在插件配置中。没有任何云端依赖。

**Q：支持手机端吗？**
A：目前仅支持桌面端。

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

---

## Install

### Manual

1. Download `release.zip` from [Releases](../../releases)
2. Extract to get `main.js`, `manifest.json`, `styles.css`, `versions.json`
3. Create folder `.obsidian/plugins/pensea/` in your vault
4. Copy all 4 files into that folder
5. Restart Obsidian → Settings → Community plugins → Enable **Pensea**

### BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add Beta Plugin → `https://github.com/y15865708228-pixel/yang`
3. Enable Pensea

---

## Quick Start

1. **Initialize**: Command palette (`Ctrl/Cmd + P`) → `Pensea: 初始化 Vault 结构`
2. **Open kanban**: Click ✨ icon in sidebar or run `Pensea: 打开 Sparks 看板`
3. **Configure LLM (optional)**: Settings → Pensea → Select provider → Enter API Key → Test

Supported providers: OpenAI · DeepSeek · Kimi · MiniMax · GLM · Ollama · Claude · Gemini · Custom

All core features work offline without LLM configuration.

---

## FAQ

**Q: Does it work without AI?**
A: Yes. Kanban, calendar, spaced repetition, weekly reports, archival all work offline.

**Q: Which AI provider do you recommend?**
A: DeepSeek for best value. Ollama for free local use. OpenAI for best quality.

**Q: Is my API key safe?**
A: Keys are stored locally in your Obsidian plugin config. Never sent to third parties.

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
