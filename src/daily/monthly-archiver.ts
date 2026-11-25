import { App, Notice, normalizePath, TFile, TFolder } from "obsidian";
import type { ParaWavesSettings } from "../types";

function monthTotals(done: number, total: number, days: number, eol = "\n") {
  const percent = total ? Math.round(100 * done / total) : 0;
  return {
    fields: [`total_tasks: ${total}`, `done_tasks: ${done}`, `pending_tasks: ${total - done}`].join(eol),
    overview: [
      `<!-- pensea:monthly ${done}/${total}/${days} -->`, "## 概览", "",
      `- 完成 ${done}/${total} 项任务（${percent}%）`, `- 共 ${days} 天日记`,
      total > done ? `- ${total - done} 项任务未完成` : "- 所有任务已完成",
    ].join(eol),
  };
}

function refreshMonthTotals(current: string, sources: Set<string>, done: number, total: number): string {
  const header = current.match(/^---(\r?\n)[\s\S]*?\r?\n---(?=\r?\n|$)/);
  const marker = /^<!-- pensea:monthly (\d+)\/(\d+)\/(\d+) -->\r?$/m.exec(current);
  if (!header || !marker) return current; // 0.1.3 totals can include journals no longer in Daily.
  for (const day of current.matchAll(/^<!-- pensea:daily-end (\d{4}-\d{2}-\d{2}) -->\r?$/gm)) {
    if (!sources.has(day[1])) return current;
  }
  const eol = header[1];
  const previous = monthTotals(Number(marker[1]), Number(marker[2]), Number(marker[3]), eol);
  const body = current.slice(header[0].length);
  if (!header[0].includes(eol + previous.fields + eol) || !body.includes(previous.overview + eol)) {
    return current; // An author has edited the properties or the overview.
  }
  const next = monthTotals(done, total, sources.size, eol);
  return header[0].replace(eol + previous.fields + eol, eol + next.fields + eol)
    + body.replace(previous.overview + eol, next.overview + eol);
}

export async function archiveMonthlyDaily(
  app: App,
  settings: ParaWavesSettings
): Promise<void> {
  const { vault } = app;
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const month = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}`;
  const folder = vault.getAbstractFileByPath(normalizePath(settings.dailyPath));
  if (!(folder instanceof TFolder)) {
    new Notice("日记文件夹不存在");
    return;
  }

  const dayNames = new Set(Array.from({ length: lastDay.getDate() }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, "0")}.md`));
  const files = folder.children.filter((file): file is TFile => file instanceof TFile && dayNames.has(file.name));
  if (!files.length) {
    new Notice(`${month} 没有找到日记`);
    return;
  }

  // Keep the source at its original path, including its frontmatter, links and review history.
  // Each distinct snapshot is append-only so a late entry can never replace an older one.
  const days = await Promise.all(files.sort((a, b) => a.name.localeCompare(b.name)).map(async file => {
    const content = await vault.read(file);
    const section = [
      `## ${file.basename}`,
      `原日记：[[${file.path}]]`,
      "",
      content,
      `<!-- pensea:daily-end ${file.basename} -->`,
    ].join("\n");
    const lines = content.split(/\r?\n/);
    const completed = lines.filter(line => /^- \[[xX]\]\s+\S/.test(line)).length;
    const pending = lines.flatMap(line => {
      const task = line.match(/^- \[ \]\s+(\S.*)$/);
      return task ? [`- [ ] ${task[1]}（[[${file.path}]]）`] : [];
    });
    return { section, completed, pending };
  }));

  const archiveDir = normalizePath(`${settings.archivePath}/Daily`);
  if (!vault.getAbstractFileByPath(archiveDir)) {
    try {
      await vault.createFolder(archiveDir);
    } catch (error) {
      if (!(vault.getAbstractFileByPath(archiveDir) instanceof TFolder)) throw error;
    }
  }
  const path = normalizePath(`${archiveDir}/${month}.md`);
  const doneTasks = days.reduce((sum, day) => sum + day.completed, 0);
  const totalTasks = days.reduce((sum, day) => sum + day.pending.length, doneTasks);
  const sources = new Set(files.map(file => file.basename));
  let report = vault.getAbstractFileByPath(path);
  if (!report) {
    const totals = monthTotals(doneTasks, totalTasks, sources.size);
    try {
      report = await vault.create(path, [
        "---", "type: 月度汇总", `month: ${month}`, totals.fields, "tags: [日记, 归档]",
        `created: ${now.toISOString().slice(0, 10)}`, "---",
        "", `# ${month} 月度汇总`, "", totals.overview, "",
      ].join("\n"));
    } catch (error) {
      report = vault.getAbstractFileByPath(path);
      if (!(report instanceof TFile)) throw error;
    }
  }
  if (!(report instanceof TFile)) throw new Error(`月报路径已被目录占用：${path}`);

  let added = 0;
  await vault.process(report, current => {
    const archived = current.replace(/\r\n/g, "\n");
    const newDays = days.filter(day => !archived.includes(day.section.replace(/\r\n/g, "\n")));
    added = newDays.length;
    const updated = refreshMonthTotals(current, sources, doneTasks, totalTasks);
    if (!added) return updated;
    const sections = newDays.map(day => day.section);
    const pending = newDays.flatMap(day => day.pending);
    const done = newDays.reduce((sum, day) => sum + day.completed, 0);
    sections.unshift(`本次收录 ${added} 天日记，已完成 ${done}/${done + pending.length} 项任务。`);
    if (pending.length) sections.push(["### 本次归档的未完成任务", ...pending].join("\n"));
    return updated + "\n\n" + sections.join("\n\n") + "\n";
  });
  new Notice(added ? `${month} 月报已补入 ${added} 天的日记原文` : `${month} 月报已是最新`);
}
