// ParaWaves 类型定义

// ─── Plugin 接口（避免 any + 循环依赖）───

export interface PenseaPlugin {
  settings: ParaWavesSettings;
  llmProvider: import("./llm/provider").LLMProvider | null;
  loadData(): Promise<Record<string, unknown>>;
  saveData(data: Record<string, unknown>): Promise<void>;
  saveSettings(): Promise<void>;
  generateDailyTemplate(ds: string): Promise<string>;
}

// ─── LLM Provider ───

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  provider: "openai-compat" | "claude" | "gemini";
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  // Embedding 配置（可选，默认使用与 chat 相同的 provider）
  embeddingModel?: string;
  embeddingBaseURL?: string;   // 仅 Claude 需要单独配置（Claude 无 embedding API）
  embeddingApiKey?: string;    // 仅 Claude 需要单独配置
}

// ─── Sparks ───

export type SparkStatus = "🫧待孵化" | "🔥孵化中" | "✅准备好" | "❌已放弃";

export interface Spark {
  filePath: string;
  title: string;
  status: SparkStatus;
  source: string;
  area: string;
  project: string;
  created: string;
  updated: string;
  staleDays: number;
}

// ─── Spaced Repetition ───

export type Rating = 1 | 2 | 3 | 4; // Again / Hard / Good / Easy

export interface ReviewData {
  filePath: string;
  easeFactor: number;   // default 2.5
  interval: number;     // days until next review
  repetitions: number;  // consecutive correct responses
  nextReview: string;   // ISO date
  lastReview: string;   // ISO date
}

export interface ReviewCard {
  cardId: string;         // filePath for file-level, filePath#hash for flashcards
  filePath: string;
  title: string;
  stage: string;
  cardType: "file" | "flashcard";
  frontContent: string;
  backContent?: string;   // only for flashcard type
  reviewData: ReviewData;
}

// ─── LLM Wiki ───

export interface IngestResult {
  sourcePath: string;
  summary: string;
  classification: {
    area: string;
    tags: string[];
    relatedConcepts: string[];
  };
  wikiPagesCreated: string[];
  wikiPagesUpdated: string[];
}

export interface LintIssue {
  type: "contradiction" | "orphan" | "stale" | "missing-link" | "data-gap";
  severity: "critical" | "warning" | "info";
  page: string;
  description: string;
  suggestion: string;
}

// ─── Weekly ───

export interface WeeklyStats {
  weekLabel: string;
  newNotes: number;
  inboxRemaining: number;
  sparkTransitions: Record<SparkStatus, number>;
  reviewsCompleted: number;
  reviewsDue: number;
  wikiPagesTotal: number;
  lintIssues: number;
  pendingTasks: { text: string; from: string }[];
}

// ─── Settings ───

export interface ParaWavesSettings {
  // LLM
  llm: LLMConfig;

  // Vault paths
  inboxPath: string;
  projectsPath: string;
  areasPath: string;
  resourcesPath: string;
  archivePath: string;
  sparksPath: string;
  dailyPath: string;
  templatesPath: string;
  tasksPath: string;
  wikiPath: string;

  // SRS
  defaultEaseFactor: number;
  defaultInterval: number;

  // Sparks
  staleThresholdHatch: number;  // days before 🫧 is stale
  staleThresholdIncubate: number; // days before 🔥 is stale

  // Feature toggles
  enableNotifications: boolean;

  // Onboarding
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: ParaWavesSettings = {
  llm: {
    provider: "openai-compat",
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    maxTokens: 4096,
    temperature: 0.3,
  },

  inboxPath: "0-Inbox",
  projectsPath: "1-Projects",
  areasPath: "2-Areas",
  resourcesPath: "3-Resources",
  archivePath: "4-Archive",
  sparksPath: "Sparks",
  dailyPath: "Daily",
  templatesPath: "Templates",
  tasksPath: "Tasks",
  wikiPath: "3-Resources/LLM-Wiki",

  defaultEaseFactor: 2.5,
  defaultInterval: 1,

  staleThresholdHatch: 3,
  staleThresholdIncubate: 7,

  enableNotifications: true,
  onboardingCompleted: false,
};
