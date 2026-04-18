import { App, Modal } from "obsidian";
import type { ReviewCard } from "../types";
import { applyReview } from "./review-scheduler";

export class ReviewModal extends Modal {
  private cards: ReviewCard[];
  private currentIdx = 0;
  private plugin: { loadData: () => Promise<Record<string, unknown>>; saveData: (d: Record<string, unknown>) => Promise<void> };
  private onComplete: () => void;

  constructor(
    app: App,
    plugin: { loadData: () => Promise<Record<string, unknown>>; saveData: (d: Record<string, unknown>) => Promise<void> },
    cards: ReviewCard[],
    onComplete: () => void
  ) {
    super(app);
    this.plugin = plugin;
    this.cards = cards;
    this.onComplete = onComplete;
  }

  onOpen() {
    this.showCard();
  }

  private showCard() {
    if (this.currentIdx >= this.cards.length) {
      this.showComplete();
      return;
    }

    const card = this.cards[this.currentIdx];
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pw-review-modal");

    // 进度
    const progress = contentEl.createDiv({ cls: "pw-review-progress" });
    progress.style.cssText = "text-align:center;color:var(--text-muted);font-size:0.85em;margin-bottom:12px;";
    progress.textContent = `${this.currentIdx + 1} / ${this.cards.length}`;

    // 标题
    contentEl.createEl("h3", { text: card.title });
    const stageEl = contentEl.createEl("span", {
      cls: "pw-review-stage",
      text: `阶段: ${card.stage}`,
    });
    stageEl.style.cssText = "color:var(--text-muted);font-size:0.85em;margin-bottom:16px;display:block;";

    if (card.cardType === "flashcard") {
      // ─── 闪卡模式：先看正面，翻转看背面 ───
      const front = contentEl.createDiv({ cls: "card-front" });
      front.style.cssText = "padding:16px;background:var(--background-secondary);border-radius:8px;margin-bottom:16px;white-space:pre-wrap;";
      front.textContent = card.frontContent;

      const revealBtn = contentEl.createEl("button", { text: "显示答案", cls: "mod-cta" });
      revealBtn.style.cssText = "display:block;margin:0 auto 16px;";
      revealBtn.addEventListener("click", () => {
        revealBtn.remove();
        // 显示背面
        const back = contentEl.createDiv({ cls: "card-back" });
        back.style.cssText = "padding:16px;background:var(--background-primary-alt);border-radius:8px;margin-bottom:16px;border-top:2px solid var(--interactive-accent);white-space:pre-wrap;";
        back.textContent = card.backContent || "";
        // 显示评分按钮
        this.showRatingButtons(contentEl, card);
      });
    } else {
      // ─── 文件模式：直接显示内容 + 评分 ───
      const front = contentEl.createDiv({ cls: "card-front" });
      front.textContent = card.frontContent || "（无内容）";
      this.showRatingButtons(contentEl, card);
    }

    // 跳过按钮
    const skipBtn = contentEl.createEl("button", { text: "跳过", cls: "mod-muted" });
    skipBtn.style.cssText = "display:block;margin:12px auto 0;";
    skipBtn.addEventListener("click", () => {
      this.currentIdx++;
      this.showCard();
    });
  }

  private showRatingButtons(contentEl: HTMLElement, card: ReviewCard) {
    const btnRow = contentEl.createDiv({ cls: "rating-buttons" });

    const ratings: { label: string; cls: string; value: number; hint: string }[] = [
      { label: "再来", cls: "again", value: 1, hint: "不记得" },
      { label: "困难", cls: "hard", value: 2, hint: "想起来了但很吃力" },
      { label: "良好", cls: "good", value: 3, hint: "正常回忆起来" },
      { label: "简单", cls: "easy", value: 4, hint: "毫不费力" },
    ];

    for (const r of ratings) {
      const btn = btnRow.createEl("button", { cls: `rating-btn ${r.cls}`, text: r.label });
      btn.title = r.hint;
      btn.addEventListener("click", async () => {
        await applyReview(this.plugin, card.cardId, card.filePath, r.value);
        this.currentIdx++;
        this.showCard();
      });
    }
  }

  private showComplete() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "复习完成！" });
    contentEl.createEl("p", { text: `本轮共复习 ${this.cards.length} 张卡片。` });
    const closeBtn = contentEl.createEl("button", { text: "关闭", cls: "mod-cta" });
    closeBtn.addEventListener("click", () => {
      this.close();
      this.onComplete();
    });
  }
}
