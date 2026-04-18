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

# ParaWaves

> 人机协作的个人知识管理系统
> **odo** 决策 · 创造 · 复盘 ｜ **waves** 整理 · 连接 · 提醒

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
| 0-Inbox | 不知道放哪 | 先放着，waves 会分类 |

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

## [${new Date().toISOString().slice(0, 10)}] ParaWaves 初始化

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

  // 4. 创建 Sparks MOC
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

  new Notice(`ParaWaves 初始化完成！新建 ${created} 项，跳过 ${skipped} 项`);
}
