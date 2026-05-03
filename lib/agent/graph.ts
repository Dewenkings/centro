/**
 * Centro Agent — LangGraph.js StateGraph
 * Day 4+ 实现：LLM 意图识别 + 条件边 + 多轮追问 + 约束迭代
 *
 * 流程：
 *   START → parseInput → [条件边]
 *     ├─ missingInfo → END（追问）
 *     ├─ iterate（换关键词）→ searchPoi（跳过 geocode/computeCenter）
 *     ├─ clarify（补充信息）→ 合并后走正常流程
 *     └─ new（全新请求）→ geocode → computeCenter → searchPoi → planRoutes → rankResults → END
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
// 1. State 定义
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
// 2. 类型定义
// ============================================================

type UserIntent = "new" | "iterate" | "clarify";

interface ParsedInput {
  participants?: Array<{ name?: string; address?: string }>;
  keywords?: string;
  city?: string;
  intent: UserIntent;
  newKeywords?: string;
  missingInfo?: string;
}

// ============================================================
// 3. Node 实现
// ============================================================

/**
 * 生成意图识别的系统 Prompt
 */
function buildIntentPrompt(hasPrevState: boolean, prevInfo: string): string {
  const base = `你是一个智能聚会选址助手。请分析用户输入，判断用户意图并提取信息。

意图类型说明：
- "new"：全新的聚会请求，包含地址和聚会类型。完整解析所有字段。
- "iterate"：在已有推荐基础上换关键词/换类型。如"换成KTV"、"吃日料吧"、"我想换一家"。只填写 newKeywords 字段。
- "clarify"：补充之前缺失的信息。如"在苏州"、"我是小明，住观前街"。只返回新补充或修改的信息，已有信息不填。

规则：
1. 如果用户说"换成XX"、"改一下"、"换一家"，intent 必须是 "iterate"
2. 如果用户只输入一个关键词（如"KTV"、"日料"），且有对话历史，intent 是 "iterate"
3. 如果用户补充地址/城市/人名，intent 是 "clarify"
4. 如果是全新请求，intent 是 "new"
5. 如果信息缺失且无法推断，返回 missingInfo`;

  if (hasPrevState) {
    return `${base}\n\n【当前已保存的信息】${prevInfo}\n请基于上下文判断用户意图。`;
  }
  return `${base}\n\n【当前没有已保存的信息】这是一个全新请求。`;
}

/**
 * 合并 clarify 结果和 prevState
 */
function mergeClarify(
  prev: typeof GatherAnnotation.State,
  parsed: ParsedInput
): Partial<typeof GatherAnnotation.Update> {
  const mergedParticipants =
    parsed.participants && parsed.participants.length > 0
      ? [...prev.participants]
      : prev.participants;

  // 如果 clarify 补充了新的参与者，合并进去
  if (parsed.participants) {
    for (const p of parsed.participants) {
      if (!p.name || !p.address) continue;
      const existing = mergedParticipants.find((ep) => ep.name === p.name);
      if (existing) {
        existing.address = p.address;
        existing.location = undefined; // 地址变了，清空旧坐标
      } else {
        mergedParticipants.push({ name: p.name, address: p.address });
      }
    }
  }

  const mergedCity = parsed.city || prev.city;
  const mergedKeywords = parsed.keywords || prev.keywords;

  // 检查是否还有缺失
  let missingInfo: string | undefined;
  if (mergedParticipants.length === 0) missingInfo = "请提供参与者地址";
  else if (!mergedCity) missingInfo = "请提供城市名";
  else if (!mergedKeywords) missingInfo = "请提供聚会类型";

  if (missingInfo) {
    return {
      participants: mergedParticipants,
      city: mergedCity,
      keywords: mergedKeywords,
      missingInfo,
      status: "collecting",
      conversationHistory: [
        { role: "assistant", content: `我需要更多信息：${missingInfo}` },
      ],
    };
  }

  return {
    participants: mergedParticipants,
    city: mergedCity,
    keywords: mergedKeywords,
    status: "geocoding",
    missingInfo: undefined,
  };
}

/**
 * Node 1: parseInput — LLM 意图识别 + 信息提取
 */
async function parseInputNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  const history = state.conversationHistory;
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");

  if (!lastUserMsg) {
    return { missingInfo: "未收到用户输入", status: "collecting" };
  }

  const hasPrevState =
    state.participants.length > 0 && !!state.centerPoint;

  // ===== MOCK 模式 =====
  if (process.env.MOCK_LLM === "true") {
    const content = lastUserMsg.content;

    // 迭代检测
    if (hasPrevState) {
      const isIterate =
        content.length < 10 ||
        ["换", "改", "不要"].some((k) => content.includes(k));
      if (isIterate) {
        const newKeyword = content.replace(/换|改|成|换成|改为|不要|换一个|改一下/g, "").trim() || "餐厅";
        return {
          keywords: newKeyword,
          status: "searching",
          candidates: [],
          routes: [],
          recommendations: [],
          missingInfo: undefined,
          conversationHistory: [
            { role: "assistant", content: `好的，为您重新搜索"${newKeyword}"...` },
          ],
        };
      }
    }

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
    if (content.includes("上饶")) city = "上饶";
    if (content.includes("广信区")) {
      mockParticipants.push({ name: "我", address: "上饶广信区" });
    }
    if (content.includes("鄱阳湖")) {
      mockParticipants.push({ name: "他", address: "上饶鄱阳湖" });
    }
    if (content.includes("火锅")) keywords = "火锅";
    if (content.includes("KTV")) keywords = "KTV";
    if (content.includes("咖啡")) keywords = "咖啡厅";
    if (content.includes("炒粉")) keywords = "炒粉";

    if (mockParticipants.length < 1) {
      return {
        missingInfo: "请提供具体地址信息",
        status: "collecting",
        conversationHistory: [
          {
            role: "assistant",
            content: "请告诉我聚会成员的地址，比如'我住在观前街，小明住在阳澄湖'",
          },
        ],
      };
    }

    return {
      participants: mockParticipants,
      keywords,
      city,
      status: "geocoding",
      missingInfo: undefined,
    };
  }

  // ===== LLM 意图识别 =====
  const prevInfo = hasPrevState
    ? `参与者：${state.participants.map((p) => `${p.name}(${p.address})`).join("、")}，城市：${state.city || "未知"}，关键词：${state.keywords || "未知"}`
    : "";

  const systemPrompt = buildIntentPrompt(hasPrevState, prevInfo);

  const schemaDesc = JSON.stringify({
    intent: "new | iterate | clarify",
    participants: [
      { name: "称呼", address: "地址" },
    ],
    keywords: "聚会类型，如火锅、KTV、咖啡厅",
    city: "城市名",
    newKeywords: "当 intent='iterate' 时，用户想要的新关键词",
    missingInfo: "信息缺失描述，或 null",
  });

  const parsed = await chatJSON<ParsedInput>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: lastUserMsg.content },
    ],
    schemaDesc
  );

  // ===== 按意图处理 =====

  // 1. 迭代请求
  if (parsed.intent === "iterate") {
    const newKeyword = parsed.newKeywords || parsed.keywords || "餐厅";
    return {
      keywords: newKeyword,
      status: "searching",
      candidates: [],
      routes: [],
      recommendations: [],
      missingInfo: undefined,
      conversationHistory: [
        { role: "assistant", content: `好的，为您重新搜索"${newKeyword}"...` },
      ],
    };
  }

  // 2. 补充信息
  if (parsed.intent === "clarify" && hasPrevState) {
    return mergeClarify(state, parsed);
  }

  // 3. 全新请求
  // 合并 prevState 中的城市信息
  if (!parsed.city && state.city) {
    parsed.city = state.city;
  }

  // 城市推断兜底
  if (!parsed.city && parsed.participants?.length) {
    const knownCities: Record<string, string> = {
      观前街: "苏州", 阳澄湖: "苏州", 独墅湖: "苏州", 苏州中心: "苏州",
      广信区: "上饶", 鄱阳湖: "上饶",
    };
    for (const p of parsed.participants) {
      for (const [key, city] of Object.entries(knownCities)) {
        if (p.address?.includes(key)) {
          parsed.city = city;
          break;
        }
      }
      if (parsed.city) break;
    }
  }

  // 如果 missingInfo 包含城市且没推断出来，用 LLM 专门推断一次
  if (parsed.missingInfo?.includes("城市") && !parsed.city && parsed.participants?.length) {
    const addresses = parsed.participants.map((p) => p.address).join("、");
    const cityInference = await chatJSON<{ city: string | null; ambiguous: boolean }>(
      [
        {
          role: "system",
          content: "你是一个中国地理助手。根据给出的地址，判断这些地址属于哪个城市。如果能唯一确定返回 city，有歧义返回 ambiguous: true",
        },
        { role: "user", content: `这些地址属于哪个城市：${addresses}` },
      ],
      JSON.stringify({
        city: "城市名或 null",
        ambiguous: "boolean",
      })
    );
    if (!cityInference.ambiguous && cityInference.city) {
      parsed.city = cityInference.city;
    }
  }

  // 补上城市后清除 missingInfo
  if (parsed.missingInfo?.includes("城市") && parsed.city) {
    parsed.missingInfo = undefined;
  }

  if (parsed.missingInfo) {
    return {
      missingInfo: parsed.missingInfo,
      status: "collecting",
      conversationHistory: [
        { role: "assistant", content: `我需要更多信息：${parsed.missingInfo}` },
      ],
    };
  }

  const participants: Participant[] = (parsed.participants || [])
    .filter((p) => p?.name && p?.address)
    .map((p) => ({ name: p.name!, address: p.address! }));

  if (participants.length < 1) {
    return {
      missingInfo: "请至少提供一个人的地址",
      status: "collecting",
      conversationHistory: [
        { role: "assistant", content: "请至少提供一个人的地址，比如'我住在观前街'" },
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
 * Node 2: geocode
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

  return { participants, status: "geocoding" };
}

/**
 * Node 3: computeCenter
 */
async function computeCenterNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  const locations = state.participants
    .map((p) => p.location)
    .filter((loc): loc is string => !!loc);

  if (locations.length === 0) {
    return { missingInfo: "没有可用的位置信息", status: "collecting" };
  }

  const centerPoint = computeCentroid(locations);
  return { centerPoint, status: "searching" };
}

/**
 * Node 4: searchPoi — 支持 Fallback 策略
 */
async function searchPoiNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  if (!state.centerPoint) {
    return { missingInfo: "无法计算中心点", status: "collecting" };
  }

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
 * Node 5: planRoutes — 公交失败 fallback 驾车
 */
async function planRoutesNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  if (state.missingInfo || state.candidates.length === 0) {
    return { routes: [], status: "ranking" };
  }

  const participants = state.participants.filter((p) => p.location);
  const candidates = state.candidates;
  const city = state.city || "苏州";
  const routes: RouteResult[] = [];

  for (const poi of candidates) {
    for (const p of participants) {
      const route = await routePlan(p.location!, poi.location, "transit", city);
      if (!("error" in route)) {
        routes.push(route);
        continue;
      }
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

  return { routes, status: "ranking" };
}

/**
 * Node 6: rankResults
 */
async function rankResultsNode(
  state: typeof GatherAnnotation.State
): Promise<Partial<typeof GatherAnnotation.Update>> {
  const participants = state.participants.filter((p) => p.location);
  const candidates = state.candidates;
  const allRoutes = state.routes;

  if (candidates.length === 0) {
    const errorMsg =
      state.missingInfo || "未找到合适的聚会场所，请换个关键词或地址试试";
    return {
      recommendations: [],
      status: "done",
      conversationHistory: [{ role: "assistant", content: errorMsg }],
    };
  }

  // 近似坐标匹配（高德 API 返回精度可能不同）
  function isSameLocation(a?: string, b?: string): boolean {
    if (!a || !b) return false;
    const [aLng, aLat] = a.split(",").map(Number);
    const [bLng, bLat] = b.split(",").map(Number);
    return Math.abs(aLng - bLng) < 0.001 && Math.abs(aLat - bLat) < 0.001;
  }

  const recommendations: Recommendation[] = candidates.map((poi) => {
    const poiRoutes = allRoutes.filter((r) => isSameLocation(r.destination, poi.location));
    const routesForParticipants = participants.map((p) => {
      const route = poiRoutes.find((r) => isSameLocation(r.origin, p.location));
      const distance_km = route?.distance_km ?? 999;
      const duration_min = route?.duration_min ?? 999;

      let transportMode = "公交";
      if (distance_km >= 999) transportMode = "未知";
      else if (distance_km < 3) transportMode = "步行/骑行";
      else if (distance_km < 15) transportMode = "公交/地铁";
      else if (distance_km < 50) transportMode = "驾车";
      else transportMode = "高铁+当地交通";

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

    return { poi, routes: routesForParticipants, totalDuration, maxDuration };
  });

  recommendations.sort((a, b) => a.maxDuration - b.maxDuration);

  return {
    recommendations,
    status: "done",
    conversationHistory: [
      { role: "assistant", content: formatRecommendations(recommendations) },
    ],
  };
}

/**
 * 格式化聊天回复
 */
function formatRecommendations(recs: Recommendation[]): string {
  if (recs.length === 0) return "抱歉，没有生成推荐结果。";

  const best = recs[0];
  const allModes = best.routes.map((r) => r.transportMode);
  const needsLongDistance = allModes.some(
    (m) => m === "高铁+当地交通" || m === "驾车"
  );
  const transportHint = needsLongDistance ? "（部分成员建议驾车/高铁出行）" : "";

  return `🎯 为您推荐 ${recs.length} 个聚会地点，详情见右侧卡片。\n\n最优推荐：${best.poi.name} ⭐${best.poi.rating || "暂无"}${transportHint}\n等待时间 ${best.maxDuration} 分钟（最慢的人到达时间）。`;
}

// ============================================================
// 4. 构建 StateGraph + 条件边
// ============================================================

const graphBuilder = new StateGraph(GatherAnnotation)
  .addNode("parseInput", parseInputNode)
  .addNode("geocode", geocodeNode)
  .addNode("computeCenter", computeCenterNode)
  .addNode("searchPoi", searchPoiNode)
  .addNode("planRoutes", planRoutesNode)
  .addNode("rankResults", rankResultsNode)
  .addEdge(START, "parseInput")
  .addConditionalEdges("parseInput", (state) => {
    // 1. 缺失信息 → 结束，等待用户补充
    if (state.missingInfo) return END;

    // 2. 约束迭代：已有 participants 和 centerPoint → 跳过 geocode
    if (state.participants.length > 0 && state.centerPoint) {
      return "searchPoi";
    }

    // 3. 正常流程
    return "geocode";
  })
  .addEdge("geocode", "computeCenter")
  .addEdge("computeCenter", "searchPoi")
  .addEdge("searchPoi", "planRoutes")
  .addEdge("planRoutes", "rankResults")
  .addEdge("rankResults", END);

export const graph = graphBuilder.compile();
