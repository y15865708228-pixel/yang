import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { ParaWavesSettings } from "../types";

// PARA 目录结构（通用，不绑定具体业务）
const PARA_DIRS = [
  "0-Inbox",
  "1-Projects",
  "2-Areas",
  "3-Resources/LLM-Wiki",
  "4-Archive",
  "Tasks",
  "Sparks",
  "Daily",
  "Templates",
];

// ─── 模板内容 ───

const TEMPLATES: Record<string, string> = {
  "Templates/通用笔记.md": `---
type: 笔记
area: ""
tags: []
created: {{date}}
---

`,

  "Templates/读书笔记.md": `---
type: 读书笔记
stage: 复习
book: ""
author: ""
rating: /5
tags:
  - 读书笔记
created: {{date}}
---

> [!abstract] 一句话总结
> 

***

## 要点

1. 
2. 
3. 

## 摘录

> 

***

## 这本书改变了我什么

-
`,

  "Templates/概念卡片.md": `---
type: 概念卡片
stage: 复习
concept: ""
aliases: []
tags:
  - 概念
created: {{date}}
---

> [!info] 定义
> 

***

## 我的理解

> 

## 例子

> 

***

**关联**
- [[]]
`,

  "Templates/课程笔记.md": `---
type: 课程笔记
stage: 复习
course: ""
platform: ""
progress: 0%
tags:
  - 课程
created: {{date}}
---

## 第 _ 讲：{{title}}

***

> [!abstract] 要点
> 

**笔记**

-

***

**闪卡**
问题::答案

***

- [ ] 行动项
`,

  "Templates/灵感卡片.md": `---
type: 灵感卡片
stage: 待孵化
spark_status: 🫧待孵化
source: ""
area: ""
tags:
  - 灵感
created: {{date}}
updated: {{date}}
---

> [!tip] 想法
> 

***

**下一步**
- [ ] 
`,

  "Templates/项目计划.md": `---
type: 项目计划
stage: 规划
area: ""
status: 进行中
date_start: {{date}}
date_end:
tags:
  - 项目
created: {{date}}
---

> [!target] 目标
> 做完能得到什么

***

**成功标准**
- [ ] 

***

**关键节点**
- [ ] 
- [ ] 

***

**下一步**
- [ ] 
`,

  "Templates/项目复盘.md": `---
type: 项目复盘
stage: 费曼
project: ""
date_start:
date_end: {{date}}
tags:
  - 复盘
created: {{date}}
---

|        |          |
|:-------|:---------|
| 目标   |          |
| 实际   |          |
| 差距   |          |

***

## 做得好的

1. 
2. 

## 做得不好的

1. 
2. 

***

> [!tip] 学到的
> 

**下次改进**
- 
`,

  "Templates/会议记录.md": `---
type: 会议记录
date: {{date}}
topic: ""
tags:
  - 会议
created: {{date}}
---

**议题**
1. 
2. 

***

## 关键信息

- 

***

**决议**
- 

**待办**
- [ ] 
`,

  "Templates/每周回顾.md": `---
type: 每周回顾
week: "{{date:GGGG-WW}}"
date: {{date}}
tags:
  - 周回顾
created: {{date}}
---

## 本周完成

- 

***

> [!abstract] 本周学到
> 

***

## Sparks 变化

| 灵感 | 之前 | 现在 | 决定 |
|:-----|:-----|:-----|:-----|
|      |      |      |      |

***

**下周重点**
1. 
2. 

***

| 精力 | 情绪 | 备注 |
|:----:|:----:|:-----|
| /10  | /10  |      |
`,

  "Templates/日记.md": `---
type: 日记
date: {{date}}
weather: ""
mood: ""
tags:
  - 日记
created: {{date}}
---

**今日三件事**
- [ ] 
- [ ] 
- [ ] 

***

## 记录

***

> [!quote] 感恩
> 

**明日**
- 
`,

  "Templates/网页剪藏.md": `---
type: 网页剪藏
source: ""
author: ""
tags: []
created: {{date}}
---

> [!abstract] 核心观点
> 

***

## 我的看法

> 

***

**行动**
- [ ] 
`,

  "Templates/人物卡片.md": `---
type: 人物卡片
name: ""
relation: ""
contact: ""
tags:
  - 人脉
created: {{date}}
---

> [!info] 印象
> 

***

**交集**
- 

***

| 我能帮 | 对方能帮 |
|:-------|:---------|
|        |          |

***

**跟进**
- [ ] 
`,

  "Templates/习惯追踪.md": `---
type: 习惯追踪
area: ""
habit: ""
frequency: 每日
start: {{date}}
target: 66
tags:
  - 习惯
created: {{date}}
---

> [!tip] 为什么养这个习惯
> 

> [!tip] 触发条件
> 什么时候做

***

## 记录

| 日期       | 完成 | 备注 |
|:-----------|:----:|:-----|
| {{date}}   |      |      |

***

**复盘**
> 
`,

  "Templates/检查清单.md": `---
type: 检查清单
area: ""
purpose: ""
tags:
  - 清单
created: {{date}}
---

> [!info] 什么时候用
> 

***

## 清单

- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 

***

**备注**
> 
`,
};




// ─── Home.md ───

const HOME_MD = `---
created: ${new Date().toISOString().slice(0, 10)}
---

# Pensea（思海）

> 打开就做，不胡思乱想
> **你** 决策 · 创造 · 复盘 ｜ **Pensea** 整理 · 连接 · 提醒

---

## 快速入口

| 系统 | 路径 | 用途 |
|---|---|---|
| 收集箱 | [[0-Inbox]] | 临时存放，不分类 |
| 活跃项目 | [[1-Projects]] | 有截止日期的项目 |
| 长期领域 | [[2-Areas]] | 持续关注的领域 |
| 知识库 | [[3-Resources]] | 方法论、读书笔记、Wiki |
| 任务 | [[Tasks]] | 待办事项 |
| 灵感池 | [[Sparks/Sparks MOC]] | 🫧→🔥→✅→❌ |
| 日记 | [[Daily]] | 每日记录 |

## PARA 分类规则

| 文件夹 | 放什么 | 判断标准 |
|---|---|---|
| 1-Projects | 有截止日期的事 | 能用"完成"来形容 |
| 2-Areas | 需要持续维护的领域 | 搞砸了会有后果 |
| 3-Resources | 感兴趣的参考素材 | 不维护也行 |
| 4-Archive | 不再活跃的东西 | 搜索能找到 |
| 0-Inbox | 不知道放哪 | 先放着，Pensea 会分类 |

## 方法论闭环

SQ3R（初学）→ 卡片盒（积累）→ 费曼（理解）→ 刻意练习（精进）→ 间隔重复（巩固）

## 每周检查

- [ ] 每周回顾
- [ ] Inbox 清零
- [ ] Sparks 状态流转
- [ ] 复习到期卡片
`;

// ─── Area MOC 模板（动态生成，由 ingest 按需创建）───

function areaMocContent(name: string): string {
  return `---
type: MOC
area: ${name}
created: ${new Date().toISOString().slice(0, 10)}
---

# ${name}

## 活跃项目

## 关键页面

## SOP & 检查清单
`;
}

// ─── Sparks MOC ───

const SPARKS_MOC = `---
type: MOC
created: ${new Date().toISOString().slice(0, 10)}
---

# Sparks 灵感池

## 流转规则

| 状态 | 含义 | 停留时间 | 下一步 |
|---|---|---|---|
| 🫧待孵化 | 刚冒出来的想法 | ≤3天 | 决定是否孵化 |
| 🔥孵化中 | 正在验证可行性 | ≤7天 | 补充分析后决定 |
| ✅准备好 | 可执行 | 立即 | 创建项目或任务 |
| ❌已放弃 | 放弃了 | 归档 | 记录放弃原因 |
`;

// ─── Tasks 看板 ───

const TASKS_BOARD = `---
type: 看板
created: ${new Date().toISOString().slice(0, 10)}
---

# 任务看板

## 本周必做

## 等待中

## 将来也许
`;

// ─── Pensea 使用手册 ───

const GUIDE_MD = `---
type: 使用手册
tags:
  - Pensea
created: ${new Date().toISOString().slice(0, 10)}
---

# Pensea 使用手册

> 打开就做，不胡思乱想

## 核心理念

Pensea 解决一个问题：打开 Obsidian 就知道该做什么。侧边栏看板把所有待办一目了然地展示出来，不需要思考优先级，按顺序做就行。

## 每天的工作流

### 打开 Obsidian 时

1. 看一眼侧边栏看板 → 知道今天有什么待处理
2. 处理红色高亮的过期灵感 → 决定继续还是放弃
3. 如果有到期复习卡片 → 点"复习卡片"开始
4. 点月历上的今天 → 打开日记开始记录

### 有新想法时

- **方式 1**：看板顶部输入框，直接输入回车创建灵感
- **方式 2**：在任意笔记中选中文字 → 右键 → "🫧 转为灵感"

### 灵感孵化后

- 点灵感右侧的箭头按钮流转到下一阶段
- ✅ 准备好的灵感可以点"立项"直接创建项目
- 右键灵感行可以切换到任意状态

## 功能说明

### 灵感看板（Sparks）

灵感有四个阶段的生命周期：

| 状态 | 含义 | 超时提醒 |
|------|------|----------|
| 🫧 待孵化 | 刚冒出来的想法 | >3天变红 |
| 🔥 孵化中 | 正在验证可行性 | >7天变橙 |
| ✅ 准备好 | 可以执行了 | — |
| ❌ 已放弃 | 放弃了 | — |

### 间隔重复复习

基于 SM-2 算法，写过的笔记会按时回来找你。复习时：

1. 看到卡片正面内容
2. 点"翻转"查看背面
3. 根据记忆程度评分：Again / Hard / Good / Easy
4. 系统自动安排下次复习时间

### 日记系统

- 月历点击日期即可创建或打开日记
- 日记自动包含前一天/后一天导航链接
- 昨天的未完成任务会自动迁移到今天
- 支持农历显示

### LLM 功能（需要配置 AI）

配置路径：设置 → Pensea → 选择提供商 → 填入 API Key → 测试

| 功能 | 说明 |
|------|------|
| 处理 Inbox | AI 自动分类归档 Inbox 中的笔记 |
| Wiki 提问 | 对知识库提问，AI 检索并综合回答 |
| 健康检查 | 检测知识库中的矛盾、孤儿页面、过时信息 |
| 整理排版 | AI 重新排版当前笔记 |
| 继续写 | AI 分析笔记并给出续写建议 |
| 智能命名 | AI 根据内容自动生成文件名 |

推荐 AI 提供商：
- **DeepSeek**：性价比最高，国内直连
- **Ollama**：完全免费，本地部署
- **OpenAI**：效果最好，需翻墙

### 周报与归档

- 命令面板搜"生成本周回顾"，自动汇总本周数据
- 命令面板搜"归档上月日记"，合并旧日记并迁移未完成任务

## 快捷键

所有功能通过命令面板（Ctrl/Cmd + P）访问，搜索"Pensea"即可看到全部命令。

## 常见问题

**不用 AI 能用吗？**
可以。看板、日历、复习、周报、归档全部离线可用。

**数据在哪？**
全在你的 Vault 里，笔记是 Markdown 文件，无云端依赖。

**支持手机吗？**
支持。安装到 Obsidian 手机端的插件目录即可，已做移动端适配。
`;

// ─── LLM Wiki 初始文件 ───

const INDEX_MD = `---
type: wiki-index
created: ${new Date().toISOString().slice(0, 10)}
updated: ${new Date().toISOString().slice(0, 10)}
---

# Wiki Index

> 由 waves 自动维护的内容索引

## 概念

## 实体

## 来源
`;

const LOG_MD = `---
type: wiki-log
---

# Wiki Log

> 所有 ingest/query/lint 操作的按时间记录

## [${new Date().toISOString().slice(0, 10)}] Pensea 初始化

Vault 初始化完成。
`;

// ─── 执行初始化 ───

export async function scaffoldVault(app: App, settings: ParaWavesSettings): Promise<void> {
  const { vault } = app;
  let created = 0;
  let skipped = 0;

  // 1. 创建目录
  for (const dir of PARA_DIRS) {
    const path = normalizePath(dir);
    if (!vault.getAbstractFileByPath(path)) {
      await vault.createFolder(path);
      created++;
    } else {
      skipped++;
    }
  }

  // 2. 创建模板文件
  for (const [path, content] of Object.entries(TEMPLATES)) {
    const np = normalizePath(path);
    if (!vault.getAbstractFileByPath(np)) {
      await vault.create(np, content);
      created++;
    } else {
      skipped++;
    }
  }

  // 3. 创建 Home.md
  const homePath = normalizePath("Home.md");
  if (!vault.getAbstractFileByPath(homePath)) {
    await vault.create(homePath, HOME_MD);
    created++;
  } else {
    skipped++;
  }

  // 4. 创建使用手册
  const guidePath = normalizePath("3-Resources/Pensea 使用手册.md");
  if (!vault.getAbstractFileByPath(guidePath)) {
    await vault.create(guidePath, GUIDE_MD);
    created++;
  } else {
    skipped++;
  }

  // 5. 创建 Sparks MOC
  const sparksPath = normalizePath("Sparks/Sparks MOC.md");
  if (!vault.getAbstractFileByPath(sparksPath)) {
    await vault.create(sparksPath, SPARKS_MOC);
    created++;
  } else {
    skipped++;
  }

  // 5. 创建 Tasks
  const tasksPath = normalizePath("Tasks/Tasks.md");
  if (!vault.getAbstractFileByPath(tasksPath)) {
    await vault.create(tasksPath, TASKS_BOARD);
    created++;
  } else {
    skipped++;
  }

  // 6. 创建 LLM Wiki 初始文件
  const indexPath = normalizePath(`${settings.wikiPath}/index.md`);
  if (!vault.getAbstractFileByPath(indexPath)) {
    await vault.create(indexPath, INDEX_MD);
    created++;
  }
  const logPath = normalizePath(`${settings.wikiPath}/log.md`);
  if (!vault.getAbstractFileByPath(logPath)) {
    await vault.create(logPath, LOG_MD);
    created++;
  }

  new Notice(`Pensea 初始化完成！新建 ${created} 项，跳过 ${skipped} 项`);
}
