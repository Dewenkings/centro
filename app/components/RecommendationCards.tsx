"use client";

import { Recommendation } from "@/types";
import { MapPin, Phone, Clock, Navigation, Star } from "lucide-react";

interface Props {
  recommendations: Recommendation[];
}

export default function RecommendationCards({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        <p>发送聚会信息，获取推荐结果</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 pb-4 scrollbar-thin">
      {recommendations.slice(0, 5).map((rec, i) => {
        const hasValidRoutes =
          rec.routes.length > 0 &&
          Number.isFinite(rec.totalDuration) &&
          Number.isFinite(rec.maxDuration);

        return (
          <div
            key={i}
            className="flex-shrink-0 w-[260px] bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md pb-2"
          >
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${
                    i === 0
                      ? "bg-red-500"
                      : i === 1
                        ? "bg-orange-500"
                        : i === 2
                          ? "bg-amber-500"
                          : "bg-gray-400"
                  }`}
                >
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {rec.poi.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1 ml-7">
                <span className="flex items-center gap-0.5 text-xs text-amber-500">
                  <Star size={11} fill="currentColor" />
                  {rec.poi.rating || "暂无"}
                </span>
                <span className="text-[11px] text-gray-400">
                  {rec.poi.type.split(";")[0]}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-start gap-1.5 text-xs text-gray-600">
                <MapPin size={12} className="mt-0.5 shrink-0 text-gray-400" />
                <span className="line-clamp-2">{rec.poi.address}</span>
              </div>

            {rec.poi.tel && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Phone size={12} className="shrink-0 text-gray-400" />
                <span>{rec.poi.tel}</span>
              </div>
            )}

            {/* Routes */}
            <div className="pt-1.5 border-t border-gray-50 space-y-1">
              {hasValidRoutes ? (
                rec.routes.map((r) => (
                  <div
                    key={r.participantName}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-500">{r.participantName}</span>
                    <span className="flex items-center gap-1 text-gray-700">
                      <Navigation size={11} className="text-blue-400" />
                      {r.duration_min}分钟
                      <span className="text-gray-300">|</span>
                      {r.distance_km}km
                      {r.transportMode && (
                        <span className="ml-0.5 text-[10px] px-1 py-0.5 bg-gray-100 rounded text-gray-500">
                          {r.transportMode}
                        </span>
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-amber-600">路线暂不可用</p>
              )}
            </div>

            {/* Summary */}
            {hasValidRoutes && (
              <div className="flex items-center gap-3 pt-1.5 border-t border-gray-50">
                <span className="flex items-center gap-1 text-xs font-medium text-gray-800">
                  <Clock size={11} />
                  等待 {rec.maxDuration}分钟
                </span>
                <span className="text-xs text-gray-400">
                  平均 {Math.round(rec.totalDuration / rec.routes.length)}分钟
                </span>
              </div>
            )}

            {/* 综合出行建议 */}
            {(() => {
              if (!hasValidRoutes) return null;
              const modes = rec.routes.map((r) => r.transportMode);
              const hasLong = modes.some((m) => m === "高铁+当地交通" || m === "驾车");
              const allWalk = modes.every((m) => m === "步行/骑行");
              if (allWalk) {
                return (
                  <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    <Navigation size={10} />
                    距离很近，步行/骑行即可到达
                  </div>
                );
              }
              if (hasLong) {
                const longUsers = rec.routes
                  .filter((r) => r.transportMode === "高铁+当地交通" || r.transportMode === "驾车")
                  .map((r) => r.participantName)
                  .join("、");
                const hasHighSpeed = rec.routes.some((r) => r.transportMode === "高铁+当地交通");
                return (
                  <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    <Navigation size={10} />
                    {longUsers} 建议{hasHighSpeed ? "高铁+当地交通" : "驾车"}前往
                  </div>
                );
              }
              return null;
            })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
