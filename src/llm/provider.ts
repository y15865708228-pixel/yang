import type { LLMConfig, LLMMessage } from "../types";

// LLM Provider 接口
export interface LLMProvider {
  chat(messages: LLMMessage[], systemPrompt?: string, maxTokens?: number): Promise<string>;
  stream(messages: LLMMessage[], systemPrompt?: string): AsyncGenerator<string, void, unknown>;
  embed(texts: string[]): Promise<number[][]>;
}

// Provider 工厂
export function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case "claude":
      return new ClaudeProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "openai-compat":
    default:
      return new OpenAICompatProvider(config);
  }
}

// ─── OpenAI 兼容适配器（覆盖 OpenAI / DeepSeek / Kimi / MiniMax / GLM / Ollama）───

class OpenAICompatProvider implements LLMProvider {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], systemPrompt?: string, maxTokens?: number): Promise<string> {
    const allMessages = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...messages]
      : messages;

    const resp = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: allMessages,
        max_tokens: maxTokens ?? this.config.maxTokens ?? 4096,
        temperature: this.config.temperature ?? 0.3,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`LLM API 错误 (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content && data.choices?.[0]?.finish_reason !== "length") {
      const finishReason = data.choices?.[0]?.finish_reason;
      throw new Error(
        `LLM 返回为空 (finish_reason: ${finishReason ?? "unknown"})。` +
        `响应: ${JSON.stringify(data).substring(0, 200)}`
      );
    }
    return content ?? "";
  }

  async *stream(messages: LLMMessage[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
    const allMessages = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...messages]
      : messages;

    const resp = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: allMessages,
        max_tokens: this.config.maxTokens ?? 4096,
        temperature: this.config.temperature ?? 0.3,
        stream: true,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`LLM API 错误 (${resp.status}): ${err}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error("无法读取响应流");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed SSE
        }
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    // 支持独立 Embedding 配置（Kimi/Claude 等不支持 Embedding 的 provider 需要配置）
    const embBaseURL = this.config.embeddingBaseURL || this.config.baseURL;
    const embModel = this.config.embeddingModel ?? "text-embedding-3-small";
    const embKey = this.config.embeddingApiKey || this.config.apiKey;

    const resp = await fetch(`${embBaseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${embKey}`,
      },
      body: JSON.stringify({
        model: embModel,
        input: texts,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Embedding API 错误 (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return (data.data ?? []).map((d: any) => d.embedding as number[]);
  }
}

class ClaudeProvider implements LLMProvider {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], systemPrompt?: string, maxTokens?: number): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: maxTokens ?? this.config.maxTokens ?? 4096,
      messages: messages.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.content,
      })),
    };
    if (systemPrompt) body.system = systemPrompt;

    const resp = await fetch(`${this.config.baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Claude API 错误 (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return data.content?.[0]?.text ?? "";
  }

  async *stream(messages: LLMMessage[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 4096,
      stream: true,
      messages: messages.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.content,
      })),
    };
    if (systemPrompt) body.system = systemPrompt;

    const resp = await fetch(`${this.config.baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Claude API 错误 (${resp.status}): ${err}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error("无法读取响应流");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta") {
            const text = parsed.delta?.text;
            if (text) yield text;
          }
        } catch {
          // skip malformed SSE
        }
      }
    }
  }

  // Claude 本身不提供 embedding API，必须配置独立的 Embedding 服务
  async embed(texts: string[]): Promise<number[][]> {
    const embBaseURL = this.config.embeddingBaseURL;
    const embModel = this.config.embeddingModel ?? "text-embedding-3-small";
    const embKey = this.config.embeddingApiKey || this.config.apiKey;

    if (!embBaseURL) {
      throw new Error("Claude 不支持 Embedding，请在设置中配置 Embedding API 地址（如 OpenAI、DeepSeek）");
    }

    const resp = await fetch(`${embBaseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${embKey}`,
      },
      body: JSON.stringify({ model: embModel, input: texts }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Embedding API 错误 (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return (data.data ?? []).map((d: any) => d.embedding as number[]);
  }
}

class GeminiProvider implements LLMProvider {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], systemPrompt?: string, maxTokens?: number): Promise<string> {
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens ?? this.config.maxTokens ?? 4096,
        temperature: this.config.temperature ?? 0.3,
      },
    };
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const url = `${this.config.baseURL}/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini API 错误 (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  async *stream(_messages: LLMMessage[], _systemPrompt?: string): AsyncGenerator<string, void, unknown> {
    // Gemini streaming 需要 streamGenerateContent 端点，此处简化为非流式
    const result = await this.chat(_messages, _systemPrompt);
    yield result;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const url = `${this.config.baseURL}/v1beta/models/${this.config.embeddingModel ?? "text-embedding-004"}:batchEmbedContents?key=${this.config.apiKey}`;

    const requests = texts.map((text) => ({
      model: `models/${this.config.embeddingModel ?? "text-embedding-004"}`,
      content: { parts: [{ text }] },
    }));

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini Embedding API 错误 (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return (data.embeddings ?? []).map((e: any) => e.values as number[]);
  }
}

// 自动检测 provider 类型
export function detectProvider(baseURL: string): LLMConfig["provider"] {
  if (baseURL.includes("anthropic.com")) return "claude";
  if (baseURL.includes("generativelanguage.googleapis.com")) return "gemini";
  return "openai-compat";
}
