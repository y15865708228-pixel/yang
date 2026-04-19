import { App, Notice, normalizePath, TFile, TFolder } from "obsidian";
import type { ParaWavesSettings } from "../types";

interface DayData {
  date: string;
  weekday: string;
  tasks: { text: string; done: boolean }[];
  record: string;
}

export async function archiveMonthlyDaily(
  app: App,
  settings: ParaWavesSettings
): Promise<void> {
  const now = new Date();
  // 上月
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prevMonth.getFullYear();
  const month = prevMonth.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // 扫描上月日记
  const folder = app.vault.getAbstractFileByPath(settings.dailyPath);
  if (!folder || !(folder instanceof TFolder)) {
    new Notice("Daily 文件夹不存在");
    return;
  }

  const dayFiles: TFile[] = [];
  for (const child of folder.children) {
    if (
      child instanceof TFile &&
      child.extension === "md" &&
      child.name.startsWith(monthStr)
    ) {
      dayFiles.push(child);
    }
  }

  if (dayFiles.length === 0) {
    new Notice(`${monthStr} 没有找到日记`);
    return;
  }

  // 按日期排序
  dayFiles.sort((a, b) => a.name.localeCompare(b.name));

  // 解析每天数据
  const days: DayData[] = [];
  let totalTasks = 0;
  let doneTasks = 0;
  const pendingItems: { text: string; from: string }[] = [];
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  for (const file of dayFiles) {
    const content = await app.vault.cachedRead(file);
    const dateName = file.name.replace(".md", "");
    const d = new Date(dateName);
    const dayData: DayData = {
      date: dateName,
      weekday: `周${weekdays[d.getDay()]}`,
      tasks: [],
      record: "",
    };

    // 提取任务
    const sections = content.split("***");
    for (const line of content.split("\n")) {
      const match = line.match(/^- \[([ xX])\]\s*(.+)/);
      if (match) {
        const done = match[1] !== " ";
        dayData.tasks.push({ text: match[2].trim(), done });
        totalTasks++;
        if (done) {
          doneTasks++;
        } else {
          pendingItems.push({ text: match[2].trim(), from: dateName });
        }
      }
    }

    // 提取"记录"部分
    const recordMatch = content.match(/## 记录\s*\n([\s\S]*?)(?=\*\*\*|##|$)/);
    if (recordMatch) {
      dayData.record = recordMatch[1].trim();
    }

    days.push(dayData);
  }

  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // 确保归档目录存在
  const archiveDir = normalizePath(`${settings.archivePath}/Daily`);
  if (!app.vault.getAbstractFileByPath(archiveDir)) {
    await app.vault.createFolder(archiveDir);
  }

  // 生成月度汇总
  const summaryPath = normalizePath(`${archiveDir}/${monthStr}.md`);
  const lines: string[] = [
    "---",
    "type: 月度汇总",
    `month: ${monthStr}`,
    `total_tasks: ${totalTasks}`,
    `done_tasks: ${doneTasks}`,
    `pending_tasks: ${pendingItems.length}`,
    "tags:",
    "  - 日记",
    "  - 归档",
    `created: ${now.toISOString().slice(0, 10)}`,
    "---",
    "",
    `# ${monthStr} 月度汇总`,
    "",
    "## 概览",
    "",
    `- 完成 ${doneTasks}/${totalTasks} 项任务（${pct}%）`,
    `- 共 ${days.length} 天日记`,
    pendingItems.length > 0 ? `- ${pendingItems.length} 项任务未完成` : "- 所有任务已完成",
    "",
  ];

  // 每日详情
  for (const day of days) {
    lines.push(`## ${day.date} ${day.weekday}`);
    if (day.tasks.length > 0) {
      lines.push("");
      lines.push("**任务**");
      for (const t of day.tasks) {
        const mark = t.done ? "[x]" : "[ ]";
        const suffix = t.done ? "" : "  ⬅ 未完成";
        lines.push(`- ${mark} ${t.text}${suffix}`);
      }
    }
    if (day.record) {
      lines.push("");
      lines.push("**记录**");
      lines.push(day.record);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // 遗留事项
  if (pendingItems.length > 0) {
    lines.push("## 遗留事项");
    lines.push("");
    for (const item of pendingItems) {
      lines.push(`- [ ] ${item.text}（来自 ${item.from}）`);
    }
    lines.push("");
  }

  // 写入汇总
  const existing = app.vault.getAbstractFileByPath(summaryPath);
  if (existing && existing instanceof TFile) {
    await app.vault.modify(existing, lines.join("\n"));
  } else {
    await app.vault.create(summaryPath, lines.join("\n"));
  }

  // 删除原始日记
  for (const file of dayFiles) {
    await app.vault.trash(file, true);
  }

  new Notice(`${monthStr} 已归档：${days.length} 天日记合并为月度汇总，${pendingItems.length} 项遗留`);
}
