# ParaWaves

> PARA 方法论 + 灵感流转 + 间隔重复 + LLM 知识库 —— 一站式 Obsidian 知识管理插件

## 功能

### Sparks 灵感看板

侧边栏看板，四列流转：待孵化 → 孵化中 → 准备好 → 已放弃。支持过期检测、快速创建、一键立项。

### 间隔重复复习

基于 SM-2 算法，自动构建复习队列，翻转卡片式复习界面（Again / Hard / Good / Easy）。

### LLM Wiki

- **Ingest** — 扫描 Inbox 笔记，LLM 自动分类、摘要、写入 Wiki
- **Query** — 对知识库提问，LLM 检索相关页面并综合回答
- **Lint** — 健康检查：检测矛盾、孤儿页面、过时信息
- **Embedding 索引** — 语义搜索，增量更新

### 日历 & 日记

看板内置月历视图，点击日期创建/打开日记，显示今日任务进度。

### 写作助手

- 整理笔记排版（LLM 驱动）
- 继续写（基于上下文续写）

### 其他

- 一键初始化 PARA Vault 结构
- 周报自动生成（含未完成任务）
- 月度日记归档
- 右键选中文字 → 转为灵感
- 自定义 SVG 图标 + 暖色主题
- 8 家 LLM 提供商支持（OpenAI / DeepSeek / Kimi / MiniMax / GLM / Ollama / Claude / Gemini）

## 安装

### 手动安装

1. 下载 [最新发布](https://github.com/odo-agent/para-waves-plugin/releases)
2. 解压到 Vault 的 `.obsidian/plugins/para-waves/` 目录
3. 在 Obsidian 设置 → 社区插件中启用 ParaWaves

### BRAT

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. 添加 Beta 插件：`odo-agent/para-waves-plugin`
3. 启用插件

### 主题

推荐搭配 [ParaWaves 主题](https://github.com/odo-agent/para-waves-theme) 使用，获得统一的视觉体验。

## 配置

安装后在设置 → ParaWaves 中配置：

1. **选择 LLM 提供商** — 下拉选择预设，自动填充 API 地址和模型
2. **填入 API Key** — 密钥仅存储在本地 `data.json`
3. **测试连接** — 点击"测试"按钮验证配置
4. **初始化 Vault** — 运行命令 `ParaWaves: 初始化 Vault 结构`

### 支持的 LLM

| 提供商 | 默认模型 | 备注 |
|--------|----------|------|
| OpenAI | gpt-4o-mini | |
| DeepSeek | deepseek-chat | |
| Kimi (Moonshot) | moonshot-v1-8k | |
| MiniMax | MiniMax-Text-01 | |
| GLM (智谱) | glm-4-flash | |
| Ollama (本地) | qwen2.5:7b | 需本地运行 Ollama |
| Claude (Anthropic) | claude-sonnet-4-20250514 | |
| Gemini (Google) | gemini-2.0-flash | |
| 自定义 | — | 兼容 OpenAI 格式即可 |

## 命令一览

| 命令 | 说明 |
|------|------|
| `初始化 Vault 结构` | 创建 PARA 目录 + 模板 |
| `打开 Sparks 看板` | 打开侧边栏看板 |
| `测试 LLM 连接` | 验证 API 配置 |
| `复习到期卡片` | 启动间隔重复复习 |
| `Wiki: 处理 Inbox` | LLM 扫描 Inbox 并归档 |
| `Wiki: 提问` | 对知识库提问 |
| `Wiki: 健康检查` | 检测 Wiki 问题 |
| `重建 Wiki Embedding 索引` | 重建语义搜索索引 |
| `整理笔记排版` | LLM 整理当前笔记 |
| `继续写` | LLM 续写当前笔记 |
| `生成本周回顾` | 生成周报笔记 |
| `归档上月日记` | 合并归档上月日记 |

## Vault 结构

```
Vault/
├── 0-Inbox/          # 收集箱
├── 1-Projects/       # 项目
├── 2-Areas/          # 领域
├── 3-Resources/      # 资源
│   └── LLM-Wiki/     # LLM 维护的知识库
├── 4-Archive/        # 归档
├── Sparks/           # 灵感卡片
├── Daily/            # 日记
├── Templates/        # 模板
└── Tasks/            # 任务
```

## 开发

```bash
git clone https://github.com/odo-agent/para-waves-plugin.git
cd para-waves-plugin
npm install
npm run dev    # 开发模式（热重载）
npm run build  # 生产构建
```

## License

MIT
