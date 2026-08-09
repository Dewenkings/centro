export const MAX_MESSAGE_LENGTH = 300;
export const MAX_HISTORY_MESSAGES = 20;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ValidAgentRequest {
  message: string;
  history: ChatMessage[];
  prevState: Record<string, unknown>;
}

export type ValidationResult =
  | { ok: true; value: ValidAgentRequest }
  | {
      ok: false;
      status: 400;
      code:
        | "INVALID_MESSAGE"
        | "MESSAGE_TOO_LONG"
        | "HISTORY_TOO_LONG"
        | "INVALID_REQUEST";
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"
  );
}

export function validateAgentRequest(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_REQUEST",
      error: "请求格式不正确。",
    };
  }

  if (typeof input.message !== "string" || !input.message.trim()) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_MESSAGE",
      error: "请输入聚会信息后再发送。",
    };
  }

  const message = input.message.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 400,
      code: "MESSAGE_TOO_LONG",
      error: `每次最多输入 ${MAX_MESSAGE_LENGTH} 个字符。`,
    };
  }

  const history = input.history ?? [];
  const prevState = input.prevState ?? {};
  if (
    !Array.isArray(history) ||
    !history.every(isChatMessage) ||
    !isRecord(prevState)
  ) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_REQUEST",
      error: "请求格式不正确。",
    };
  }

  if (history.length > MAX_HISTORY_MESSAGES) {
    return {
      ok: false,
      status: 400,
      code: "HISTORY_TOO_LONG",
      error: "当前对话过长，请刷新页面后重新开始。",
    };
  }

  return { ok: true, value: { message, history, prevState } };
}

export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}
