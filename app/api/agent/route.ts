/**
 * Next.js API Route — Agent 入口（SSE 流式输出）
 * POST /api/agent
 *
 * 流式渲染改造：graph.invoke → graph.stream
 * 每个节点执行完成后推送一次 state 更新，前端实时渲染进度
 */

import { NextRequest, NextResponse } from "next/server";
import { graph } from "@/lib/agent/graph";
import { GatherState } from "@/types";
import { getClientIdentifier, validateAgentRequest } from "@/lib/demo/guard";
import { checkPublicDemoQuota } from "@/lib/demo/quota";
import { getQuotaHttpError } from "@/lib/demo/quota-http";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: "INVALID_JSON", error: "请求格式不正确。" },
        { status: 400 }
      );
    }

    const validation = validateAgentRequest(body);
    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          code: validation.code,
          error: validation.error,
        },
        { status: validation.status }
      );
    }

    if (!process.env.LLM_API_KEY || !process.env.AMAP_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          code: "LIVE_DEMO_UNAVAILABLE",
          error: "在线搜索暂时不可用，请先体验示例场景。",
        },
        { status: 503 }
      );
    }

    if (process.env.DEMO_RATE_LIMIT_ENABLED !== "false") {
      const quota = await checkPublicDemoQuota(
        getClientIdentifier(request.headers)
      );
      if (!quota.allowed) {
        const failure = getQuotaHttpError(quota);
        return NextResponse.json(
          {
            success: false,
            code: failure.code,
            error: failure.error,
          },
          {
            status: failure.status,
            headers: {
              "Retry-After": String(failure.retryAfterSeconds),
            },
          }
        );
      }
    }

    const { message, history, prevState } = validation.value;

    const conversationHistory = [
      ...history,
      { role: "user" as const, content: message },
    ];

    const initialState: Partial<GatherState> = {
      ...prevState,
      conversationHistory,
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // ========== 核心改造：graph.stream 替代 graph.invoke ==========
          const eventStream = await graph.stream(initialState, {
            streamMode: "values",
          });

          for await (const state of eventStream) {
            const lastAssistantMsg = [...state.conversationHistory]
              .reverse()
              .find((m) => m.role === "assistant");

            send({
              type: "state",
              status: state.status,
              reply: lastAssistantMsg?.content || "",
              participants: state.participants,
              centerPoint: state.centerPoint,
              keywords: state.keywords,
              candidates: state.candidates,
              recommendations: state.recommendations,
              missingInfo: state.missingInfo,
              state: {
                participants: state.participants,
                centerPoint: state.centerPoint,
                keywords: state.keywords,
                city: state.city,
              },
            });
          }

          send({ type: "done" });
        } catch (error) {
          console.error(`[${requestId}] Agent stream error:`, error);
          send({
            type: "error",
            code: "AGENT_FAILED",
            error: "处理请求时出现问题，请稍后重试。",
            requestId,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Agent API error:`, error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        error: "服务暂时不可用，请稍后重试。",
        requestId,
      },
      { status: 500 }
    );
  }
}
