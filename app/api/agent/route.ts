/**
 * Next.js API Route — Agent 入口
 * POST /api/agent
 *
 * Day 4 升级：支持 prevState 传递，实现多轮对话和约束迭代
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

    // 合并 prevState（约束迭代时保留 participants、centerPoint 等）
    const initialState: Partial<GatherState> = {
      ...prevState,
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
      // 返回完整 state，前端可用于下一轮迭代
      state: {
        participants: result.participants,
        centerPoint: result.centerPoint,
        keywords: result.keywords,
        city: result.city,
      },
    });
  } catch (error) {
    console.error("Agent API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
