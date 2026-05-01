/**
 * Next.js API Route — Agent 入口
 * POST /api/agent
 *
 * Day 2 实现：接收用户消息 → 调用 LangGraph Agent → 返回结果
 * Day 3 升级：SSE 流式响应
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [] } = body;

    // TODO: Day 2 接入 LangGraph Agent
    // const result = await graph.invoke({ ... });

    return NextResponse.json({
      success: true,
      message: "Agent 尚未实现，这是占位响应",
      received: message,
    });
  } catch (error) {
    console.error("Agent API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
