import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { ParaWavesSettings, Spark, SparkStatus } from "../types";

const SPARK_STATUSES: SparkStatus[] = ["🫧待孵化", "🔥孵化中", "✅准备好", "❌已放弃"];

export function isSparkStatus(val: string): val is SparkStatus {
  return SPARK_STATUSES.includes(val as SparkStatus);
}

// 扫描 vault 中所有灵感卡片
export async function scanSparks(app: App, settings: ParaWavesSettings): Promise<Spark[]> {
  const sparks: Spark[] = [];
  const folder = app.vault.getAbstractFileByPath(normalizePath(settings.sparksPath));
  if (!folder || !(folder instanceof TFolder)) return sparks;

  const files = recursivelyGetMarkdownFiles(folder);

  for (const file of files) {
    // 优先用 metadataCache，fallback 到手动解析
    let fm: Record<string, any> | null = null;
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter) {
      fm = cache.frontmatter;
    } else {
      // Fallback: 直接读文件解析 frontmatter
      fm = await parseFrontMatter(app, file);
    }
    if (!fm || !fm.spark_status) continue;

    const status = String(fm.spark_status);
    if (!isSparkStatus(status)) continue;

    const created = fm.created ?? new Date(file.stat.ctime).toISOString().slice(0, 10);
    const updated = fm.updated ?? created;
    const staleDays = created ? daysSince(created) : 0;

    sparks.push({
      filePath: file.path,
      title: fm.title ?? file.basename,
      status,
      source: fm.source ?? "",
      area: fm.area ?? "",
      project: fm.project ?? "",
      created,
      updated,
      staleDays,
    });
  }

  return sparks;
}

// 检测过期
export function isStale(spark: Spark, settings: ParaWavesSettings): "none" | "hatch" | "incubate" {
  if (spark.status === "🫧待孵化" && spark.staleDays > settings.staleThresholdHatch) {
    return "hatch";
  }
  if (spark.status === "🔥孵化中" && spark.staleDays > settings.staleThresholdIncubate) {
    return "incubate";
  }
  return "none";
}

// 更新 spark_status frontmatter
export async function updateSparkStatus(
  app: App,
  filePath: string,
  newStatus: SparkStatus
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(normalizePath(filePath));
  if (!file || !(file instanceof TFile)) return;

  await app.fileManager.processFrontMatter(file, (fm) => {
    fm.spark_status = newStatus;
    fm.updated = new Date().toISOString().slice(0, 10);
  });
}

function recursivelyGetMarkdownFiles(folder: TFolder): TFile[] {
  const result: TFile[] = [];
  for (const child of folder.children) {
    if (child instanceof TFile && child.extension === "md") {
      result.push(child);
    } else if (child instanceof TFolder) {
      result.push(...recursivelyGetMarkdownFiles(child));
    }
  }
  return result;
}

function daysSince(dateStr: string): number {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

// 手动解析 frontmatter（metadataCache fallback）
async function parseFrontMatter(app: App, file: TFile): Promise<Record<string, any> | null> {
  try {
    const content = await app.vault.cachedRead(file);
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const yaml = match[1];
    const fm: Record<string, any> = {};
    for (const line of yaml.split("\n")) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      let val: any = line.slice(idx + 1).trim();
      // 去掉引号
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val === "true") val = true;
      if (val === "false") val = false;
      if (val !== "" && !isNaN(Number(val))) val = Number(val);
      fm[key] = val;
    }
    return fm;
  } catch {
    return null;
  }
}
