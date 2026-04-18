import { App, TFile } from "obsidian";
import type { ParaWavesSettings, ReviewData, ReviewCard } from "../types";
import { sm2, isDue } from "./sm2";

const SRS_DATA_KEY = "srsData";

// ─── Flashcard 扫描 ───

interface FlashcardPair {
  front: string;
  back: string;
  lineIndex: number;
}

function cardHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function scanFlashcards(body: string): FlashcardPair[] {
  const cards: FlashcardPair[] = [];
  const lines = body.split("\n");
  let inCodeBlock = false;
  let pendingFront: string[] = [];
  let pendingStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 跟踪代码块
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      pendingFront = [];
      continue;
    }
    if (inCodeBlock) continue;

    // 单行 :: 分隔符
    const colonIdx = line.indexOf("::");
    if (colonIdx >= 0) {
      const front = line.slice(0, colonIdx).trim();
      const back = line.slice(colonIdx + 2).trim();
      if (front && back) {
        cards.push({ front, back, lineIndex: i });
      }
      pendingFront = [];
      continue;
    }

    // 多行 ? 分隔符（独立一行）
    if (trimmed === "?") {
      if (pendingFront.length > 0) {
        const backLines: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          const nt = lines[j].trim();
          if (nt === "" || nt === "?" || lines[j].includes("::")) break;
          backLines.push(lines[j]);
          j++;
        }
        const front = pendingFront.join("\n").trim();
        const back = backLines.join("\n").trim();
        if (front && back) {
          cards.push({ front, back, lineIndex: pendingStartLine });
        }
        pendingFront = [];
        i = j - 1;
      }
      continue;
    }

    // 累积待定正面内容
    if (trimmed !== "") {
      if (pendingFront.length === 0) pendingStartLine = i;
      pendingFront.push(line);
    } else {
      pendingFront = [];
    }
  }

  return cards;
}

// ─── 复习数据持久化 ───

export function getSRSData(plugin: { loadData: () => Promise<Record<string, unknown>> }): Promise<Record<string, ReviewData>> {
  return plugin.loadData().then((d) => (d?.[SRS_DATA_KEY] as Record<string, ReviewData>) ?? {});
}

export async function saveSRSData(
  plugin: { loadData: () => Promise<Record<string, unknown>>; saveData: (d: Record<string, unknown>) => Promise<void> },
  data: Record<string, ReviewData>
): Promise<void> {
  const all = await plugin.loadData();
  all[SRS_DATA_KEY] = data;
  await plugin.saveData(all);
}

// ─── 构建复习队列 ───

export async function buildReviewQueue(
  app: App,
  settings: ParaWavesSettings,
  srsData: Record<string, ReviewData>
): Promise<ReviewCard[]> {
  const queue: ReviewCard[] = [];
  const mdFiles = app.vault.getMarkdownFiles();

  for (const file of mdFiles) {
    if (file.path.startsWith(settings.templatesPath)) continue;
    if (file.path.startsWith(".obsidian")) continue;

    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm || !fm.stage) continue;

    const content = await app.vault.cachedRead(file);
    const frontmatterEnd = content.indexOf("---", 4);
    const body = frontmatterEnd >= 0 ? content.slice(frontmatterEnd + 3).trim() : content;

    // 扫描闪卡分隔符
    const flashcards = scanFlashcards(body);

    if (flashcards.length > 0) {
      // 按行建卡
      for (const fc of flashcards) {
        const cardId = `${file.path}#${cardHash(fc.front)}`;
        let review = srsData[cardId];
        if (!review) {
          review = {
            filePath: file.path,
            easeFactor: settings.defaultEaseFactor,
            interval: settings.defaultInterval,
            repetitions: 0,
            nextReview: new Date().toISOString().slice(0, 10),
            lastReview: "",
          };
        }
        if (isDue(review)) {
          queue.push({
            cardId,
            filePath: file.path,
            title: file.basename,
            stage: fm.stage,
            cardType: "flashcard",
            frontContent: fc.front,
            backContent: fc.back,
            reviewData: review,
          });
        }
      }
    } else {
      // 无闪卡分隔符 — 按文件建卡（向后兼容）
      let review = srsData[file.path];
      if (!review) {
        review = {
          filePath: file.path,
          easeFactor: settings.defaultEaseFactor,
          interval: settings.defaultInterval,
          repetitions: 0,
          nextReview: new Date().toISOString().slice(0, 10),
          lastReview: "",
        };
      }
      if (isDue(review)) {
        const firstSection = body.split("\n## ")[0];
        queue.push({
          cardId: file.path,
          filePath: file.path,
          title: file.basename,
          stage: fm.stage,
          cardType: "file",
          frontContent: firstSection,
          reviewData: review,
        });
      }
    }
  }

  return queue;
}

// ─── 应用复习结果 ───

export async function applyReview(
  plugin: { loadData: () => Promise<Record<string, unknown>>; saveData: (d: Record<string, unknown>) => Promise<void> },
  cardId: string,
  filePath: string,
  quality: number
): Promise<void> {
  const data = await getSRSData(plugin);
  const review = data[cardId] ?? {
    filePath,
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: new Date().toISOString().slice(0, 10),
    lastReview: "",
  };

  const updated = sm2(review, quality as 1 | 2 | 3 | 4 | 5);
  data[cardId] = updated;
  await saveSRSData(plugin, data);
}
