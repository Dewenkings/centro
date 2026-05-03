/**
 * 高德地图 Web服务 API 封装
 * 4 个核心 Tool：地理编码、POI 搜索、路径规划、计算中心点
 */

const AMAP_BASE_URL_V3 = "https://restapi.amap.com/v3";
const AMAP_BASE_URL_V5 = "https://restapi.amap.com/v5";

function getAmapKey(): string {
  const key = process.env.AMAP_API_KEY || "";
  if (!key) {
    throw new Error("AMAP_API_KEY is not set. Please check your .env.local");
  }
  return key;
}

// ============================================================
// Tool 1: 地理编码 — 地名/地址 → 经纬度坐标
// ============================================================
export interface GeocodeResult {
  name: string;
  location: string; // "经度,纬度"
  formatted_address: string;
  city: string;
  district: string;
}

export async function geocode(
  address: string,
  city?: string
): Promise<GeocodeResult | { error: string }> {
  const key = getAmapKey();
  const params = new URLSearchParams({
    key: key,
    address,
    output: "JSON",
  });
  if (city) params.set("city", city);

  const url = `${AMAP_BASE_URL_V3}/geocode/geo?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await resp.json();

  if (data.status !== "1" || !data.geocodes?.length) {
    return { error: `地理编码失败: ${data.info || "未知错误"}, 地址: ${address}` };
  }

  const geo = data.geocodes[0];
  return {
    name: address,
    location: geo.location,
    formatted_address: geo.formatted_address || "",
    city: geo.city || "",
    district: geo.district || "",
  };
}

// ============================================================
// Tool 2: POI 周边搜索
// ============================================================
export interface POI {
  name: string;
  address: string;
  location: string;
  distance: string;
  tel: string;
  type: string;
  rating: string;
}

export interface SearchNearbyResult {
  count: number;
  pois: POI[];
}

export async function searchNearbyPois(
  location: string, // 格式: "经度,纬度"
  keywords: string = "餐厅",
  radius: number = 3000,
  pageSize: number = 10
): Promise<SearchNearbyResult | { error: string }> {
  const key = getAmapKey();
  const params = new URLSearchParams({
    key: key,
    location,
    keywords,
    radius: String(radius),
    page_size: String(pageSize),
    show_fields: "business",
    output: "JSON",
  });

  const url = `${AMAP_BASE_URL_V5}/place/around?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await resp.json();

  if (data.status !== "1") {
    return { error: `POI搜索失败: ${data.info || "未知错误"}` };
  }

  const pois: POI[] = (data.pois || []).map((poi: any) => ({
    name: poi.name || "",
    address: poi.address || "",
    location: poi.location || "",
    distance: poi.distance || "",
    tel:
      typeof poi.business === "object" ? poi.business.tel || "" : "",
    type: poi.type || "",
    rating:
      typeof poi.business === "object" ? poi.business.rating || "" : "",
  }));

  return { count: pois.length, pois };
}

// ============================================================
// Tool 3: 路径规划 — 起点到终点的通勤时间和距离
// ============================================================
export interface RouteResult {
  origin: string;
  destination: string;
  mode: string;
  distance_km: number;
  duration_min: number;
}

export async function routePlan(
  origin: string, // 格式: "经度,纬度"
  destination: string, // 格式: "经度,纬度"
  mode: "driving" | "walking" | "transit" = "transit",
  city: string = "苏州"
): Promise<RouteResult | { error: string }> {
  const baseUrls: Record<string, string> = {
    driving: `${AMAP_BASE_URL_V3}/direction/driving`,
    walking: `${AMAP_BASE_URL_V3}/direction/walking`,
    transit: `${AMAP_BASE_URL_V3}/direction/transit/integrated`,
  };

  const key = getAmapKey();
  const params = new URLSearchParams({
    key: key,
    origin,
    destination,
    output: "JSON",
  });

  if (mode === "transit") {
    params.set("city", city);
    params.set("strategy", "0");
  } else if (mode === "driving") {
    params.set("strategy", "2");
  }

  const url = `${baseUrls[mode]}?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await resp.json();

  if (data.status !== "1") {
    return { error: `路线规划失败: ${data.info || "未知错误"}` };
  }

  const route = data.route || {};

  let distance = 0;
  let duration = 0;

  if (mode === "driving" || mode === "walking") {
    const paths = route.paths || [];
    if (!paths.length) return { error: `未找到${mode}路线` };
    distance = parseInt(paths[0].distance || "0", 10);
    duration = parseInt(paths[0].duration || "0", 10);
  } else {
    const transits = route.transits || [];
    if (!transits.length) return { error: "未找到公交路线" };
    distance = parseInt(route.distance || "0", 10);
    duration = parseInt(transits[0].duration || "0", 10);
  }

  return {
    origin,
    destination,
    mode,
    distance_km: Math.round((distance / 1000) * 10) / 10,
    duration_min: Math.round(duration / 60),
  };
}

// ============================================================
// Tool 4: 计算地理中心点 — 本地计算，不调用 API
// ============================================================
export function computeCentroid(locations: string[]): string {
  const lngs: number[] = [];
  const lats: number[] = [];

  for (const loc of locations) {
    const [lng, lat] = loc.split(",").map(Number);
    if (!isNaN(lng) && !isNaN(lat)) {
      lngs.push(lng);
      lats.push(lat);
    }
  }

  if (!lngs.length) return "0,0";

  const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;

  return `${avgLng.toFixed(6)},${avgLat.toFixed(6)}`;
}

// ============================================================
// OpenAI 格式的 function 定义（给 LLM 用）
// ============================================================
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "geocode",
      description: "将地址或地名转换为经纬度坐标。当用户提到一个地点名称时使用。",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "地址或地名，如'苏州大学本部'、'观前街'",
          },
          city: {
            type: "string",
            description: "城市名，可选，用于提高准确性",
          },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "searchNearbyPois",
      description:
        "在指定坐标附近搜索餐厅、KTV、咖啡厅等聚会场所。通常应在所有人位置的地理中心点附近搜索。",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "搜索中心点坐标，格式'经度,纬度'",
          },
          keywords: {
            type: "string",
            description: "搜索关键词，如'火锅'、'咖啡厅'、'KTV'、'餐厅'",
          },
          radius: {
            type: "number",
            description: "搜索半径（米），默认3000",
          },
          pageSize: {
            type: "number",
            description: "返回结果数量，默认10",
          },
        },
        required: ["location", "keywords"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "routePlan",
      description:
        "计算从起点到终点的路线距离和耗时。用于计算每个人到候选聚会地点的通勤成本。",
      parameters: {
        type: "object",
        properties: {
          origin: {
            type: "string",
            description: "起点坐标，格式'经度,纬度'",
          },
          destination: {
            type: "string",
            description: "终点坐标，格式'经度,纬度'",
          },
          mode: {
            type: "string",
            description: "出行方式: driving(驾车), walking(步行), transit(公交)",
            enum: ["driving", "walking", "transit"],
          },
          city: {
            type: "string",
            description: "城市名，公交模式下必填",
          },
        },
        required: ["origin", "destination"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "computeCentroid",
      description:
        "计算多个坐标点的地理中心。当需要确定多人位置的'中间地带'时使用。",
      parameters: {
        type: "object",
        properties: {
          locations: {
            type: "array",
            items: { type: "string" },
            description: "坐标列表，每个格式'经度,纬度'",
          },
        },
        required: ["locations"],
      },
    },
  },
];

export const TOOL_MAP: Record<
  string,
  (...args: any[]) => Promise<any> | any
> = {
  geocode,
  searchNearbyPois,
  routePlan,
  computeCentroid,
};
