"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { Participant, Recommendation } from "@/types";

// 修复 Leaflet 默认图标问题
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: (icon as any).src || (icon as any),
  shadowUrl: (iconShadow as any).src || (iconShadow as any),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// 自定义图标
const participantIcon = (name: string) =>
  L.divIcon({
    className: "custom-div-icon",
    html: `<div style="background:#3b82f6;color:#fff;padding:2px 6px;border-radius:12px;font-size:11px;font-weight:bold;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.2);">${name}</div>`,
    iconSize: [60, 20],
    iconAnchor: [30, 10],
  });

const centerIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background:#10b981;color:#fff;padding:2px 6px;border-radius:12px;font-size:10px;font-weight:bold;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.2);">中心</div>`,
  iconSize: [40, 20],
  iconAnchor: [20, 10],
});

const rankIcon = (rank: number) =>
  L.divIcon({
    className: "custom-div-icon",
    html: `<div style="background:#ef4444;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${rank}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

function parseLocation(loc?: string): [number, number] | null {
  if (!loc) return null;
  const [lng, lat] = loc.split(",").map(Number);
  if (isNaN(lng) || isNaN(lat)) return null;
  return [lat, lng];
}

function FitBounds({
  participants,
  centerPoint,
  recommendations,
}: {
  participants: Participant[];
  centerPoint?: string;
  recommendations: Recommendation[];
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    participants.forEach((p) => {
      const loc = parseLocation(p.location);
      if (loc) points.push(loc);
    });
    if (centerPoint) {
      const loc = parseLocation(centerPoint);
      if (loc) points.push(loc);
    }
    recommendations.forEach((r) => {
      const loc = parseLocation(r.poi.location);
      if (loc) points.push(loc);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, participants, centerPoint, recommendations]);

  return null;
}

interface MapViewProps {
  participants: Participant[];
  centerPoint?: string;
  recommendations: Recommendation[];
}

export default function MapView({
  participants,
  centerPoint,
  recommendations,
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400 text-sm">地图加载中...</p>
      </div>
    );
  }

  // 默认中心：苏州
  const defaultCenter: [number, number] = [31.2989, 120.5853];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={11}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.amap.com/">高德地图</a>'
        url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
        subdomains={["1", "2", "3", "4"]}
      />

      <FitBounds
        participants={participants}
        centerPoint={centerPoint}
        recommendations={recommendations}
      />

      {/* 参与者标记 */}
      {participants.map(
        (p, i) =>
          p.location && (
            <Marker
              key={`participant-${i}`}
              position={parseLocation(p.location)!}
              icon={participantIcon(p.name)}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{p.name}</p>
                  <p className="text-gray-500">{p.address}</p>
                </div>
              </Popup>
            </Marker>
          )
      )}

      {/* 中心点 */}
      {centerPoint && (
        <>
          <Marker
            position={parseLocation(centerPoint)!}
            icon={centerIcon}
          >
            <Popup>地理中心点</Popup>
          </Marker>
          <Circle
            center={parseLocation(centerPoint)!}
            radius={5000}
            pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.08 }}
          />
        </>
      )}

      {/* 推荐地点标记 */}
      {recommendations.slice(0, 5).map((rec, i) => {
        const loc = parseLocation(rec.poi.location);
        if (!loc) return null;
        return (
          <Marker key={`rec-${i}`} position={loc} icon={rankIcon(i + 1)}>
            <Popup>
              <div className="text-sm max-w-[200px]">
                <p className="font-bold text-red-600">
                  #{i + 1} {rec.poi.name}
                </p>
                <p className="text-gray-500 text-xs mt-1">{rec.poi.address}</p>
                <p className="text-xs mt-1">
                  ⭐{rec.poi.rating || "暂无"} | 总通勤 {rec.totalDuration}分钟
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
