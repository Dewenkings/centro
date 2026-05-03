/**
 * Next.js API Route — Agent 入口
 * POST /api/agent
 *
 * Day 2 实现：接收用户消息 → 调用 LangGraph Agent → 返回结果
 * Day 3 升级：SSE 流式响应
 */

import { NextRequest, NextResponse } from "next/server";
import { graph } from "@/lib/agent/graph";
import { GatherState } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [] } = body;

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
      conversationHistory,
    };

    const result = await graph.invoke(initialState);

    const lastAssistantMsg = [...result.conversationHistory]
      .reverse()
      .find((m) => m.role === "assistant");

    return NextResponse.json({
      success: true,
      status: result.status,
      reply: lastAssistantMsg?.content || "处理完成",
      participants: result.participants,
      centerPoint: result.centerPoint,
      keywords: result.keywords,
      candidates: result.candidates,
      recommendations: result.recommendations,
      missingInfo: result.missingInfo,
    });
  } catch (error) {
    console.error("Agent API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
