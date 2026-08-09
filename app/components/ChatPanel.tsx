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
  presets?: Array<{ id: string; label: string; eyebrow: string }>;
  onSelectPreset?: (id: string) => void;
}

export default function ChatPanel({
  messages,
  onSend,
  loading,
  streamingContent,
  presets = [],
  onSelectPreset,
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
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#fffefb] border-r border-slate-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-[#fffefb]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              Centro<span className="text-emerald-500">.</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">AI 公平聚会选址助手</p>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-emerald-700">
            FAIR MEETUP
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-bold tracking-[0.14em] text-emerald-600">
              START WITH A SCENARIO
            </p>
            <h2 className="mt-2 text-base font-bold tracking-tight text-slate-900">
              让每个人都少绕一点路
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              输入成员位置与想去的场所，Centro 会按真实通勤时间寻找更公平的会合点。
            </p>

            {presets.length > 0 && onSelectPreset && (
              <div className="mt-4 space-y-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset.id)}
                    className="group w-full rounded-xl border border-slate-200 bg-[#f8faf7] px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <span className="block text-[10px] font-semibold text-emerald-600">
                      {preset.eyebrow}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between text-sm font-semibold text-slate-800">
                      {preset.label}
                      <span className="text-emerald-500 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="mt-4 text-[11px] text-slate-400">
              或直接输入：我住观前街，小明住阳澄湖，想吃火锅
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
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入最多 4 位成员的位置和聚会偏好..."
            maxLength={300}
            className="min-w-0 flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
