// SM-2 间隔重复算法
// 参考: https://www.supermemo.com/zh/archives1990-2015/english/ol/sm2

import type { Rating, ReviewData } from "../types";

// 计算下次复习参数
export function sm2(review: ReviewData, quality: Rating): ReviewData {
  let { easeFactor, interval, repetitions } = review;

  // quality: 1=Again, 2=Hard, 3=Good, 4=Easy, 5=Perfect
  if (quality >= 3) {
    // 通过
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  } else {
    // 不通过：重置
    repetitions = 0;
    interval = 1;
  }

  // 更新 ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const now = new Date();
  const next = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    ...review,
    easeFactor,
    interval,
    repetitions,
    nextReview: next.toISOString().slice(0, 10),
    lastReview: now.toISOString().slice(0, 10),
  };
}

// 判断是否到期复习
export function isDue(review: ReviewData): boolean {
  const next = new Date(review.nextReview);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return next <= now;
}
