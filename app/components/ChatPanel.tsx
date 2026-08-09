"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string) => void;
  loading: boolean;
  streamingContent?: string;
}

export default function ChatPanel({
  messages,
  onSend,
  loading,
  streamingContent,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <h1 className="text-lg font-bold text-gray-900">Centro</h1>
        <p className="text-xs text-gray-500 mt-0.5">AI 智能聚会选址助手</p>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-sm">👋 告诉我聚会信息</p>
            <p className="text-xs mt-2">
              例如："我住观前街，小明住阳澄湖，想吃火锅"
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-emerald-500 text-white"
              }`}
            >
              {msg.role === "user" ? (
                <User size={14} />
              ) : (
                <Bot size={14} />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {/* 流式进度消息 */}
        {loading && streamingContent && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Bot size={14} />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-text-bottom" />
            </div>
          </div>
        )}

        {/* 纯 loading 无内容时的 spinner */}
        {loading && !streamingContent && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Bot size={14} />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-gray-100 bg-white"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入聚会信息..."
            className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
