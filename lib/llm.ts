/**
 * LLM Client — 基于 OpenAI SDK 调用 Kimi / Moonshot API
 */

import OpenAI from "openai";

function getConfig() {
  const apiKey = process.env.LLM_API_KEY || "";
  const baseURL = process.env.LLM_BASE_URL || "";
  const model = process.env.LLM_MODEL || "moonshot-v1-8k";
  if (!apiKey) throw new Error("LLM_API_KEY is not set");
  if (!baseURL) throw new Error("LLM_BASE_URL is not set");
  return { apiKey, baseURL, model };
}

export interface ChatOptions {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.ChatCompletionTool[];
  temperature?: number;
  maxTokens?: number;
}

export async function chat<T = string>(
  options: ChatOptions,
  parser?: (content: string) => T
): Promise<T> {
  const { apiKey, baseURL, model } = getConfig();
  const client = new OpenAI({ apiKey, baseURL });

  const completion = await client.chat.completions.create({
    model,
    messages: options.messages,
    tools: options.tools,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 1024,
  });

  const content = completion.choices[0]?.message?.content || "";

  if (parser) {
    return parser(content);
  }

  return content as unknown as T;
}

/**
 * 强制 LLM 输出合法 JSON 的 wrapper
 */
export async function chatJSON<T>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  schemaDesc: string
): Promise<T> {
  const { apiKey, baseURL, model } = getConfig();
  const client = new OpenAI({ apiKey, baseURL });

  const systemMsg: OpenAI.Chat.ChatCompletionSystemMessageParam = {
    role: "system",
    content: `你是一个严谨的 JSON 输出助手。请严格按以下 JSON Schema 输出，不要包含任何 markdown 代码块标记或额外说明文字：\n${schemaDesc}`,
  };

  const completion = await client.chat.completions.create({
    model,
    messages: [systemMsg, ...messages],
    temperature: 0.1,
    max_tokens: 1024,
  });

  const raw = completion.choices[0]?.message?.content || "";
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error("LLM JSON parse error:", e);
    console.error("Raw output:", raw);
    throw new Error(`LLM 返回非法 JSON: ${raw.slice(0, 200)}`);
  }
}
