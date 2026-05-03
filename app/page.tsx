"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import ChatPanel from "./components/ChatPanel";
import RecommendationCards from "./components/RecommendationCards";
import { Participant, Recommendation } from "@/types";

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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [centerPoint, setCenterPoint] = useState<string>();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

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

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const assistantMsg: Message = {
          role: "assistant",
          content: data.reply || "处理完成",
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setParticipants(data.participants || []);
        setCenterPoint(data.centerPoint);
        setRecommendations(data.recommendations || []);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ 出错：${data.error || "未知错误"}` },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ 网络错误，请稍后重试" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  return (
    <main
      className={`flex h-screen w-screen overflow-hidden bg-gray-50 ${
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
        <ChatPanel messages={messages} onSend={handleSend} loading={loading} />
      </div>

      {/* 移动端全屏聊天 */}
      <div className="md:hidden w-full h-full">
        <ChatPanel messages={messages} onSend={handleSend} loading={loading} />
      </div>
    </main>
  );
}
