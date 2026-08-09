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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], prevState = {} } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "message is required" },
        { status: 400 }
      );
    }

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
          console.error("Stream error:", error);
          send({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
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
    console.error("Agent API Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
