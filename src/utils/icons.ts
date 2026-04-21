// Pensea (思海) 图标集
// 规范：24x24 viewBox, 2px stroke, round caps/joins
// 原则：每个图标 ≤3 元素, 统一曲线弧度, 曲线优先于直线
// 海洋主题通过隐喻选择体现，不硬加波浪装饰

export const PW_ICONS: Record<string, string> = {

  // ─── 统计卡片 ───

  // Inbox — whale (carrying everything in the sea)
  "pw-inbox": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12Q19 6 13 6Q7 6 5 10Q3 14 6 17Q11 19 17 16Q19 14 19 12z"/><path d="M5 10L2 6M5 10L2 14"/><path d="M15 6L15 3"/></svg>`,

  // Spark — 星芒（灵感闪光）
  "pw-spark": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"/><path d="M12 16v6"/><path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 14.83l4.24 4.24"/><path d="M2 12h6"/><path d="M16 12h6"/><path d="M4.93 19.07l4.24-4.24"/><path d="M14.83 9.17l4.24-4.24"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`,

  // Review — 叠层波（复习循环）
  "pw-review": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8Q8 5 12 8Q16 11 21 8"/><path d="M3 13Q8 10 12 13Q16 16 21 13"/><path d="M3 18Q8 15 12 18Q16 21 21 18"/></svg>`,

  // Wiki — 书页（知识库）
  "pw-wiki": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a1 1 0 0 0-1-1H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a1 1 0 0 1 1-1h9z"/></svg>`,

  // ─── 操作按钮 ───

  // Ingest — 漩涡（吸入处理）
  "pw-ingest": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12Q16 8 12 12Q8 16 3 12"/><path d="M21 17Q16 13 12 17Q8 21 3 17"/><path d="M21 7Q16 3 12 7Q8 11 3 7"/></svg>`,

  // Cards — 翻转卡片（SRS 复习）
  "pw-cards": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>`,

  // Health — 脉搏检测（健康检查）
  "pw-health": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h5"/></svg>`,

  // Chart — 水位柱（周报）
  "pw-chart": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20Q6 18 9 20Q12 22 15 20Q18 18 21 20"/><rect x="5" y="10" width="3" height="8" rx="1"/><rect x="10.5" y="4" width="3" height="14" rx="1"/><rect x="16" y="7" width="3" height="11" rx="1"/></svg>`,

  // Format — 排版笔（整理排版）
  "pw-format": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,

  // Pen — 笔（继续写）
  "pw-pen": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/><path d="M15 5l4 4"/></svg>`,

  // ─── Sparks 状态（16x16 缩放） ───

  // Hatch — 水滴（待孵化）
  "pw-hatch": `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2Q7 9 5 13a7 7 0 0 0 14 0Q17 9 12 2z"/></svg>`,

  // Fire — 火焰（孵化中）
  "pw-fire": `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-4-2-8-6-8-11a8 8 0 0 1 16 0c0 5-4 9-8 11z"/><path d="M12 22c-1.5-1-3-3-3-5.5a3 3 0 0 1 6 0c0 2.5-1.5 4.5-3 5.5z" fill="currentColor" opacity="0.2"/></svg>`,

  // Check — 圆勾（准备好）
  "pw-check": `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,

  // X — 圆叉（已放弃）
  "pw-x": `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,

  // Project — sailboat (navigate toward goal)
  "pw-project": `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v16"/><path d="M12 2l7 14H12"/><path d="M12 8L5 16h7"/><path d="M4 21Q8 19 12 21Q16 23 20 21"/></svg>`,

  // ─── 其他 ───

  // Calendar — tide clock (ocean time)
  "pw-calendar": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,

  // Arrow right — 洋流箭头
  "pw-arrow-right": `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
};

export function registerPWIcons(addIcon: (id: string, svg: string) => void) {
  for (const [id, svg] of Object.entries(PW_ICONS)) {
    addIcon(id, svg);
  }
}

export function iconHTML(iconId: string, size = 16, color = "currentColor"): string {
  const svg = PW_ICONS[iconId];
  if (!svg) return "";
  return svg
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`)
    .replace('stroke="currentColor"', `stroke="${color}"`);
}
