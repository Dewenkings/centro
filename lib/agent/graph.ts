/**
 * Centro Agent — LangGraph.js StateGraph
 * Day 2 实现：6 个 Node 编排完整推荐流程
 *
 * 流程：parseInput → geocode → computeCenter → searchPoi → planRoutes → rankResults
 */

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import {
  Participant,
  POI,
  RouteResult,
  Recommendation,
  AgentStatus,
  GatherState,
} from "@/types";
import {
  geocode,
  searchNearbyPois,
  routePlan,
  computeCentroid,
} from "@/lib/tools/amap";
import { chatJSON } from "@/lib/llm";

// ============================================================
// 1. State 定义（LangGraph Annotation）
// ============================================================

const GatherAnnotation = Annotation.Root({
  participants: Annotation<Participant[]>({
    reducer: (_a, b) => b ?? [],
    default: () => [],
  }),
  centerPoint: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
  keywords: Annotation<string>({
    reducer: (_a, b) => b ?? "",
    default: () => "",
  }),
  city: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
  candidates: Annotation<POI[]>({
    reducer: (_a, b) => b ?? [],
    default: () => [],
  }),
  routes: Annotation<RouteResult[]>({
    reducer: (_a, b) => b ?? [],
    default: () => [],
  }),
  recommendations: Annotation<Recommendation[]>({
    reducer: (_a, b) => b ?? [],
    default: () => [],
  }),
  status: Annotation<AgentStatus>({
    reducer: (_a, b) => b ?? "collecting",
    default: () => "collecting",
  }),
  missingInfo: Annotation<string | undefined>({
    reducer: (_a, b) => b,
    default: () => undefined,
  }),
  conversationHistory: Annotation<
    Array<{ role: "user" | "assistant"; content: string }>
  >({
    reducer: (a, b) => [...a, ...(b || [])],
    default: () => [],
  }),
});

// ============================================================
// 2. Node 实现
// ============================================================

interface ParsedInput {
  participants?: Array<{ name?: string; address?: string }>;
  keywords?: string;
  city?: string;
  missingInfo?: string;
}

/**
 * Node 1: parseInput — 用 LLM 解析用户输入
 */
async function parseInputNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  const history = state.conversationHistory;
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");

  if (!lastUserMsg) {
    return { missingInfo: "未收到用户输入", status: "collecting" };
  }

  // MOCK 模式：当没有可用 LLM 时直接返回硬编码解析结果
  if (process.env.MOCK_LLM === "true") {
    const content = lastUserMsg.content;
    const mockParticipants: Participant[] = [];
    let keywords = "餐厅";
    let city: string | undefined = undefined;

    if (content.includes("观前街")) {
      mockParticipants.push({ name: "我", address: "观前街" });
      city = "苏州";
    }
    if (content.includes("阳澄湖")) {
      mockParticipants.push({ name: "小明", address: "阳澄湖" });
      city = "苏州";
    }
    if (content.includes("火锅")) keywords = "火锅";
    if (content.includes("KTV")) keywords = "KTV";
    if (content.includes("咖啡")) keywords = "咖啡厅";

    return {
      participants: mockParticipants,
      keywords,
      city,
      status: "geocoding",
      missingInfo: undefined,
    };
  }

  const schemaDesc = JSON.stringify({
    participants: [
      { name: "用户提到的称呼或名字", address: "具体地址或地名" },
    ],
    keywords: "聚会类型关键词，如火锅、KTV、咖啡厅、餐厅等",
    city: "城市名，如苏州、上海",
    missingInfo: "如果地址、城市、聚会类型任一缺失，描述缺少什么；否则为 null",
  });

  const parsed = await chatJSON<ParsedInput>(
    [
      {
        role: "user",
        content: lastUserMsg.content,
      },
    ],
    schemaDesc
  );

  // 如果缺少关键信息
  if (parsed.missingInfo) {
    return {
      missingInfo: parsed.missingInfo,
      status: "collecting",
      conversationHistory: [
        {
          role: "assistant",
          content: `我需要更多信息：${parsed.missingInfo}`,
        },
      ],
    };
  }

  const participants: Participant[] = (parsed.participants || [])
    .filter((p) => p?.name && p?.address)
    .map((p) => ({
      name: p.name!,
      address: p.address!,
    }));

  if (participants.length < 1) {
    return {
      missingInfo: "请至少提供一个人的地址",
      status: "collecting",
      conversationHistory: [
        {
          role: "assistant",
          content: "请至少提供一个人的地址，比如'我住在观前街'",
        },
      ],
    };
  }

  return {
    participants,
    keywords: parsed.keywords || "餐厅",
    city: parsed.city,
    status: "geocoding",
    missingInfo: undefined,
  };
}

/**
 * Node 2: geocode — 对所有参与者地址进行地理编码
 */
async function geocodeNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  const participants = [...state.participants];
  const city = state.city;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (!p.location) {
      const result = await geocode(p.address, city);
      if ("error" in result) {
        console.error(`地理编码失败 [${p.name}]:`, result.error);
        // 失败时不中断，继续处理其他人
      } else {
        participants[i] = { ...p, location: result.location };
      }
    }
  }

  const successCount = participants.filter((p) => p.location).length;
  if (successCount === 0) {
    return {
      missingInfo: "无法解析任何地址，请检查地址是否正确",
      status: "collecting",
      conversationHistory: [
        {
          role: "assistant",
          content: "抱歉，我无法解析您提供的地址，请用更具体的地址描述。",
        },
      ],
    };
  }

  return {
    participants,
    status: "geocoding",
  };
}

/**
 * Node 3: computeCenter — 计算地理中心点
 */
async function computeCenterNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  const locations = state.participants
    .map((p) => p.location)
    .filter((loc): loc is string => !!loc);

  if (locations.length === 0) {
    return {
      missingInfo: "没有可用的位置信息",
      status: "collecting",
    };
  }

  const centerPoint = computeCentroid(locations);

  return {
    centerPoint,
    status: "searching",
  };
}

/**
 * Node 4: searchPoi — 在中心点附近搜索聚会场所
 * Fallback 策略：10km 关键词 → 10km 餐厅 → 20km 餐厅
 */
async function searchPoiNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  if (!state.centerPoint) {
    return {
      missingInfo: "无法计算中心点",
      status: "collecting",
    };
  }

  // 尝试策略列表
  const strategies: Array<{ keywords: string; radius: number; label: string }> = [
    { keywords: state.keywords, radius: 10000, label: state.keywords },
    { keywords: "餐厅", radius: 10000, label: "餐厅" },
    { keywords: "餐厅", radius: 20000, label: "餐厅" },
  ];

  for (const strategy of strategies) {
    const result = await searchNearbyPois(
      state.centerPoint,
      strategy.keywords,
      strategy.radius,
      10
    );

    if (!("error" in result) && result.pois.length > 0) {
      const fallbackMsg =
        strategy.label !== state.keywords
          ? `附近没有找到"${state.keywords}"，为您推荐附近的${strategy.label}：`
          : undefined;

      return {
        candidates: result.pois,
        keywords: strategy.keywords,
        status: "planning",
        missingInfo: undefined,
        conversationHistory: fallbackMsg
          ? [{ role: "assistant", content: fallbackMsg }]
          : undefined,
      };
    }
  }

  return {
    missingInfo: `中心点附近 20km 内没有找到任何餐厅，请更换地址或城市试试`,
    status: "collecting",
    conversationHistory: [
      {
        role: "assistant",
        content: "附近没有找到合适的聚会场所，您可以换更靠近市中心的地址再试试。",
      },
    ],
  };
}

/**
 * Node 5: planRoutes — 为每个人规划到每个候选地点的路线
 */
async function planRoutesNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  // 如果前面步骤已经失败，不再浪费 API 调用
  if (state.missingInfo || state.candidates.length === 0) {
    return { routes: [], status: "ranking" };
  }

  const participants = state.participants.filter((p) => p.location);
  const candidates = state.candidates;
  const city = state.city || "苏州";

  const routes: RouteResult[] = [];

  for (const poi of candidates) {
    for (const p of participants) {
      // 先尝试公交
      const route = await routePlan(p.location!, poi.location, "transit", city);
      if (!("error" in route)) {
        routes.push(route);
        continue;
      }

      // 公交失败 → fallback 驾车
      const drivingRoute = await routePlan(
        p.location!,
        poi.location,
        "driving",
        city
      );
      if (!("error" in drivingRoute)) {
        routes.push(drivingRoute);
      }
    }
  }

  return {
    routes,
    status: "ranking",
  };
}

/**
 * Node 6: rankResults — 计算推荐排序
 */
async function rankResultsNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  const participants = state.participants.filter((p) => p.location);
  const candidates = state.candidates;
  const allRoutes = state.routes;

  // 如果前面步骤已经失败，返回有意义的错误消息
  if (candidates.length === 0) {
    const errorMsg =
      state.missingInfo || "未找到合适的聚会场所，请换个关键词或地址试试";
    return {
      recommendations: [],
      status: "done",
      conversationHistory: [
        {
          role: "assistant",
          content: errorMsg,
        },
      ],
    };
  }

  const recommendations: Recommendation[] = candidates.map((poi) => {
    const poiRoutes = allRoutes.filter((r) => r.destination === poi.location);

    const routesForParticipants = participants.map((p) => {
      const route = poiRoutes.find((r) => r.origin === p.location);
      const distance_km = route?.distance_km ?? 999;
      const duration_min = route?.duration_min ?? 999;

      // Agent 智能判断出行方式
      let transportMode = "公交";
      if (distance_km >= 999) {
        transportMode = "未知";
      } else if (distance_km < 3) {
        transportMode = "步行/骑行";
      } else if (distance_km < 15) {
        transportMode = "公交/地铁";
      } else if (distance_km < 50) {
        transportMode = "驾车";
      } else {
        transportMode = "高铁+当地交通";
      }

      return {
        participantName: p.name,
        duration_min,
        distance_km,
        transportMode,
      };
    });

    const totalDuration = routesForParticipants.reduce(
      (sum, r) => sum + r.duration_min,
      0
    );
    const maxDuration = Math.max(
      ...routesForParticipants.map((r) => r.duration_min)
    );

    return {
      poi,
      routes: routesForParticipants,
      totalDuration,
      maxDuration,
    };
  });

  // 按最久通勤时间排序（所有人同时出发，最慢的人决定等待时间）
  recommendations.sort((a, b) => a.maxDuration - b.maxDuration);

  return {
    recommendations,
    status: "done",
    conversationHistory: [
      {
        role: "assistant",
        content: formatRecommendations(recommendations),
      },
    ],
  };
}

/**
 * 格式化推荐结果为简短聊天文本（详情见右侧卡片）
 */
function formatRecommendations(recs: Recommendation[]): string {
  if (recs.length === 0) return "抱歉，没有生成推荐结果。";

  const best = recs[0];

  // 综合判断最优推荐的主推出行方式
  const allModes = best.routes.map((r) => r.transportMode);
  const needsLongDistance = allModes.some((m) => m === "高铁+当地交通" || m === "驾车");
  const transportHint = needsLongDistance
    ? "（部分成员建议驾车/高铁出行）"
    : "";

  return `🎯 为您推荐 ${recs.length} 个聚会地点，详情见右侧卡片。\n\n最优推荐：${best.poi.name} ⭐${best.poi.rating || "暂无"}${transportHint}\n等待时间 ${best.maxDuration} 分钟（最慢的人到达时间）。`;
}

// ============================================================
// 3. 构建 StateGraph
// ============================================================

const graphBuilder = new StateGraph(GatherAnnotation)
  .addNode("parseInput", parseInputNode)
  .addNode("geocode", geocodeNode)
  .addNode("computeCenter", computeCenterNode)
  .addNode("searchPoi", searchPoiNode)
  .addNode("planRoutes", planRoutesNode)
  .addNode("rankResults", rankResultsNode)
  .addEdge(START, "parseInput")
  .addEdge("parseInput", "geocode")
  .addEdge("geocode", "computeCenter")
  .addEdge("computeCenter", "searchPoi")
  .addEdge("searchPoi", "planRoutes")
  .addEdge("planRoutes", "rankResults")
  .addEdge("rankResults", END);

export const graph = graphBuilder.compile();
