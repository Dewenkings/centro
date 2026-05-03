# Centro 项目面试文档

## 1. 项目背景

**Centro** 是一个 AI 驱动的多人聚会地点推荐系统。核心场景：几个朋友分布在不同位置，想找一个大家出行都比较方便的聚会地点。

传统方案：手动查地图、估算距离、反复沟通。Centro 让用户用自然语言描述需求，AI Agent 自动完成地址解析、中心点计算、POI 搜索、路线规划、结果排序全流程。

## 2. 核心功能

| 功能 | 说明 |
|---|---|
| 自然语言输入 | "我住在观前街，小明在阳澄湖，想吃火锅" |
| 多轮追问 | 信息不足时自动追问（如缺少城市名） |
| 约束迭代 | "换成日料"——保留地址，只更新搜索关键词 |
| 智能出行建议 | 根据距离自动推荐步行/公交/驾车/高铁 |
| 可视化 | 地图展示参与者、中心点、推荐地点 |

## 3. 技术架构

### 3.1 整体架构

```
前端 (Next.js + React + Leaflet)
  ↕
API Route (/api/agent)
  ↕
LangGraph Agent (6 个 Node)
  ↕
DeepSeek LLM + 高德地图 API
```

### 3.2 Agent 节点设计

| Node | 职责 |
|---|---|
| `parseInput` | LLM 意图识别（new/iterate/clarify），提取参与人、地址、关键词 |
| `geocode` | 地址 → 经纬度（高德地理编码） |
| `computeCenter` | 计算多点的几何中心 |
| `searchPoi` | 中心点周边 POI 搜索 + fallback 策略 |
| `planRoutes` | 为每个参与者规划到各 POI 的路线 |
| `rankResults` | 按最长耗时排序，取 Top 5 |

### 3.3 条件边（Conditional Edges）

```typescript
.addConditionalEdges("parseInput", (state) => {
  if (state.missingInfo) return END;        // 追问
  if (state.intent === "iterate") return "searchPoi";  // 换关键词
  if (state.intent === "clarify") return "geocode";    // 补充后走正常流程
  return "geocode";                         // 全新请求
})
```

## 4. 关键技术难点 & 解决方案

### 4.1 意图识别（从硬编码到 LLM）

**问题**：早期用关键词匹配（"换"、"改"）判断迭代请求，无法处理"日料"这种短输入。

**解决**：改为 LLM 三分类（new / iterate / clarify），结合上下文判断：
- 有 prevState + 输入不含地址 → iterate
- 补充城市等缺失信息 → clarify
- 否则 → new

### 4.2 远距离路线规划

**问题**：高德公交规划 API 对 >50km 返回 999 分钟（异常值）。

**解决**：公交失败时 fallback 到驾车模式，并标注"建议驾车前往"。

### 4.3 坐标精度不一致导致 NaN

**问题**：地理编码和 POI 搜索返回的坐标精度不同（如 120.626373 vs 120.62637），字符串严格匹配失败 → duration 为 undefined → Math.max(...undefined) = NaN。

**解决**：
```typescript
function isSameLocation(a?: string, b?: string): boolean {
  const [aLng, aLat] = a.split(",").map(Number);
  const [bLng, bLat] = b.split(",").map(Number);
  return Math.abs(aLng - bLng) < 0.001 && Math.abs(aLat - bLat) < 0.001;
}
```

### 4.4 搜索无结果 Fallback

**问题**：偏远地区或冷门关键词可能返回 0 条 POI。

**解决**：三级 fallback 策略：
1. 10km 半径 + 原关键词
2. 10km 半径 + "餐厅"（放宽类型）
3. 20km 半径 + "餐厅"

### 4.5 State 合并（多轮对话）

**问题**：LangGraph 的 reducer 会完全覆盖旧值，clarify 时丢失已有的 participants。

**解决**：clarify 场景下手动合并：
```typescript
function mergeClarify(prev, parsed) {
  return {
    ...parsed,
    participants: parsed.participants?.length
      ? parsed.participants
      : prev.participants,
  };
}
```

## 5. 技术选型理由

| 技术 | 选型理由 |
|---|---|
| **LangGraph.js** | 原生支持 StateGraph、条件边、循环，比硬编码 if/else 更适合多轮对话场景 |
| **DeepSeek** | 性价比高，OpenAI-compatible API，无需额外适配 |
| **高德地图** | 国内地址解析和 POI 数据最准确 |
| **Next.js** | 全栈框架，API Route + React 前端一体，部署简单 |
| **Leaflet** | 开源免费，国内可用，比 Google Maps / Mapbox 更适合国内场景 |

## 6. 面试中可以展开的点

1. **为什么不用 Function Calling？**
   - 意图识别和参数提取耦合在一起，用结构化 JSON 输出更灵活，减少 LLM 调用次数。

2. **如果用户增加到 10 人怎么办？**
   - 高德 API 有 QPS 限制，planRoutes 阶段可以并行请求但需控制并发；或预计算中心区域后批量搜索。

3. **如何评估推荐质量？**
   - 当前按 maxDuration 排序（公平性优先）。可以引入用户偏好权重（如价格、评分）。

4. **LangGraph vs 其他框架？**
   - LangGraph 的 StateGraph 很适合有明确状态流转的场景；如果是简单链式调用，LangChain LCEL 足够。

## 7. 时间线

| Day | 内容 |
|---|---|
| Day 1 | 项目初始化 + 高德 API 封装 |
| Day 2 | LangGraph Agent 6 节点 + CLI 测试 |
| Day 3 | 前端 UI（地图 + 聊天 + 推荐卡片） |
| Day 4 | 多轮对话 + LLM 意图识别 + 约束迭代 |
| Day 5 | Vercel 部署 + 文档 |
