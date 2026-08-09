"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import ChatPanel from "./components/ChatPanel";
import RecommendationCards from "./components/RecommendationCards";
import { Participant, Recommendation, AgentStatus } from "@/types";
import { DEMO_PRESETS } from "@/lib/demo/presets";

// Leaflet 需要客户端渲染，避免 SSR
const MapView = dynamic(() => import("./components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <p className="text-gray-400 text-sm">地图加载中...</p>
    </div>
  ),
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** 根据 Agent 状态生成友好的进度文案 */
function getStatusMessage(
  status: AgentStatus,
  data?: Record<string, unknown>
): string {
  switch (status) {
    case "collecting":
      return data?.missingInfo
        ? `我需要更多信息：${data.missingInfo}`
        : "正在分析您的需求...";
    case "geocoding": {
      const names =
        (data?.participants as Participant[])?.map((p) => p.name).join("、") ||
        "参与者";
      return `正在定位 ${names} 的位置...`;
    }
    case "searching":
      return `正在中心点附近搜索"${data?.keywords || "聚会场所"}"...`;
    case "planning":
      return `正在为 ${(data?.candidates as unknown[])?.length || 0} 个候选地点规划路线...`;
    case "ranking":
      return "正在综合评估最佳聚会地点...";
    case "done":
      return (
        (data?.recommendations as Recommendation[])?.length
          ? `已为您推荐 ${(data?.recommendations as Recommendation[]).length} 个聚会地点`
          : "处理完成"
      );
    default:
      return "处理中...";
  }
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [centerPoint, setCenterPoint] = useState<string>();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  // 保存 Agent 返回的 state，用于约束迭代
  const [agentState, setAgentState] = useState<Record<string, unknown>>({});
  const [mobileView, setMobileView] = useState<"chat" | "results">("chat");

  // 可拖拽分栏
  const [chatWidth, setChatWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setChatWidth(Math.max(320, Math.min(600, newWidth)));
    };
    const handleUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  const handlePreset = useCallback((presetId: string) => {
    const preset = DEMO_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setMessages([
      { role: "user", content: preset.userMessage },
      { role: "assistant", content: preset.assistantMessage },
    ]);
    setParticipants(preset.participants);
    setCenterPoint(preset.centerPoint);
    setRecommendations(preset.recommendations);
    setAgentState({});
    setMobileView("results");
  }, []);

  /** ========== 核心改造：流式消费 SSE ========== */
  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setStreamingContent("");

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages,
            prevState: agentState,
          }),
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          throw new Error(errorBody?.error || `请求失败（${res.status}）`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No response body");

        let buffer = "";
        let finalReply = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // SSE 解析：累积缓冲区，按 \n\n 分割事件
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;

              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "state") {
                  // 实时更新地图数据
                  setParticipants(data.participants || []);
                  setCenterPoint(data.centerPoint);
                  setRecommendations(data.recommendations || []);
                  if (data.recommendations?.length > 0) {
                    setMobileView("results");
                  }
                  if (data.state) setAgentState(data.state);

                  // 更新流式进度文案
                  const statusMsg = getStatusMessage(
                    data.status as AgentStatus,
                    data
                  );
                  setStreamingContent(statusMsg);

                  if (data.reply) {
                    finalReply = data.reply as string;
                  }
                } else if (data.type === "error") {
                  finalReply = `❌ ${data.error}`;
                  setStreamingContent(finalReply);
                }
              } catch {
                // 忽略解析失败的行
              }
            }
          }
        }

        // 流结束：添加最终的 assistant 消息
        if (finalReply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: finalReply },
          ]);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "网络错误";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ ${errMsg}，请稍后重试` },
        ]);
      } finally {
        setLoading(false);
        setStreamingContent("");
      }
    },
    [messages, agentState]
  );

  const presetOptions = DEMO_PRESETS.map(({ id, label, eyebrow }) => ({
    id,
    label,
    eyebrow,
  }));

  return (
    <main
      className={`flex h-full w-full overflow-hidden bg-gray-50 ${
        isDragging ? "select-none" : ""
      }`}
    >
      {/* 桌面端：左侧地图主区域 */}
      <div className="hidden md:flex flex-1 flex-col h-full min-w-0">
        <div className="flex-1 min-h-0 relative">
          <MapView
            participants={participants}
            centerPoint={centerPoint}
            recommendations={recommendations}
          />
        </div>
        <div className="h-[260px] bg-white border-t border-gray-200 flex-shrink-0">
          <RecommendationCards recommendations={recommendations} />
        </div>
      </div>

      {/* 拖拽手柄（桌面端） */}
      <div
        className="hidden md:block w-1 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0"
        onMouseDown={() => setIsDragging(true)}
        title="拖动调整宽度"
      />

      {/* 右侧聊天面板（桌面端） */}
      <div
        style={{ width: chatWidth }}
        className="hidden md:block flex-shrink-0 h-full"
      >
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          loading={loading}
          streamingContent={streamingContent}
          presets={presetOptions}
          onSelectPreset={handlePreset}
        />
      </div>

      {/* 移动端：对话与地图结果可切换 */}
      <div className="md:hidden flex w-full min-w-0 h-full flex-col overflow-hidden bg-[#f4f6f2]">
        <div className="grid grid-cols-2 gap-1 border-b border-slate-200 bg-white p-1.5">
          <button
            type="button"
            onClick={() => setMobileView("chat")}
            aria-pressed={mobileView === "chat"}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              mobileView === "chat"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            对话
          </button>
          <button
            type="button"
            onClick={() => setMobileView("results")}
            aria-pressed={mobileView === "results"}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              mobileView === "results"
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            地图与结果 {recommendations.length > 0 ? `(${recommendations.length})` : ""}
          </button>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {mobileView === "chat" ? (
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              loading={loading}
              streamingContent={streamingContent}
              presets={presetOptions}
              onSelectPreset={handlePreset}
            />
          ) : (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-[3]">
                <MapView
                  participants={participants}
                  centerPoint={centerPoint}
                  recommendations={recommendations}
                />
              </div>
              <div className="min-h-[240px] flex-[2] overflow-hidden border-t border-slate-200 bg-white">
                <RecommendationCards recommendations={recommendations} />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
