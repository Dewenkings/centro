<div align="center">

# Centro

### AI 多人公平聚会选址 Agent

**不是简单找一个地理中点，而是找到一个谁都不用太委屈的见面地点。**

告诉 Centro 每个人从哪里出发、大家想吃什么或做什么。它会把一句自然语言需求变成共享搜索区域，比较每个人到候选地点的真实路线，并在地图上解释为什么这个选择更公平。

![Next.js](https://img.shields.io/badge/Next.js-15-111827?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent-0F766E)
![高德地图](https://img.shields.io/badge/高德地图-Web服务-1677FF)
![Upstash](https://img.shields.io/badge/Upstash-Redis-00E9A3?logo=redis&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-在线体验-000000?logo=vercel)

[🚀 在线体验](https://centro-nine.vercel.app/) · [📖 English](./README.md) · [30 秒了解产品](#30-秒了解-centro) · [Agent 架构](#agent-如何工作) · [快速开始](#快速开始)

</div>

---

## 产品想解决什么

多人聚餐选址看似只是“找一家店”，真正麻烦的是背后的协调：一个人负责搜索，所有人分别查路线；有人想换菜品，讨论重新开始；有人临时换地址，之前的结论又全部失效。

Centro 把这件事当作一个有约束的多人决策，而不是普通地图搜索：

- **地理中点不等于公平地点。** 河流、道路结构、地铁换乘和拥堵，会让相同直线距离变成完全不同的通勤时间。
- **位置合适，不代表场所合适。** 公平的出行距离还要和大家真正想吃的菜、想做的活动一起考虑。
- **平均时间可能掩盖一个人的糟糕体验。** Centro 优先降低最慢到达者的通勤时间，避免一个人承担绝大多数路程。
- **推荐结果应该可以检查。** 地图和卡片会展示每个人的路线，让用户知道第一名为什么排在前面。

最终得到的不是一个“AI 说可以”的答案，而是一个全员能够讨论、继续修改、也能验证的聚会方案。

## 30 秒了解 Centro

打开[在线 Demo](https://centro-nine.vercel.app/)，点击标注为“无需 API · 示例数据”的「苏州双人火锅」。即使在线额度暂时不可用，也能完整查看聊天、地图和推荐卡片，不会消耗大模型或高德 API。

真实搜索可以从一句话开始：

```text
我住深圳坪山，小明住深圳坪洲，想吃烧烤
```

Centro 会定位两个人的出发点，重新计算共享搜索区域，寻找候选餐厅，比较每个人到每家店的路线，再按公平性排序。

接着只修改菜品：

```text
换成水煮肉
```

因为成员地址没有变化，Agent 会沿用上一轮参与者和中心位置，只重新搜索并比较新的候选场所，减少重复计算和 API 消耗。

如果地址发生变化：

```text
我地址改到深圳南山
```

Agent 会清除已经失效的坐标、中心点和推荐结果，重新地理编码并计算新方案，不会把之前城市或地址的结果带入下一轮。

这种“**复用仍然有效的状态，主动废弃已经过期的状态**”的处理方式，是 Centro 作为有状态 Agent，而不是多次独立问答的关键。

## 用户能体验到什么

| 能力 | 实际体验 |
|---|---|
| 自然语言规划 | 从中文对话中提取参与者、位置、城市和聚会偏好 |
| 多轮信息补全 | 缺少地址、城市或偏好时，针对缺失信息继续追问 |
| 有状态需求修改 | 只换菜品时复用位置；修改地址或城市时重新计算 |
| 真实路线比较 | 使用高德地理编码、POI 搜索和公交/驾车路线，不依赖直线距离猜测 |
| 公平性优先排序 | 按最慢参与者的到达时间对候选地点排序 |
| 可解释推荐 | 地图与卡片展示成员、中心区域、候选地点、距离、时间和交通方式 |
| Agent 流式过程 | 通过 SSE 展示定位、搜索、路线规划和排序状态 |
| 移动端体验 | 手机上可以在对话界面和地图结果之间切换 |
| 稳定作品集体验 | 无需凭证的确定性示例，在实时 API 不可用时仍然能够展示完整结果 |

## 为什么它不只是一个地图 Demo

Centro 的核心能力都有明确、可检查的实现机制，而不是只在 README 中描述“使用了 AI”。

### 1. 明确的 Agent 状态流转

LangGraph 工作流会区分不同类型的用户输入：

```text
全新需求       → 地理编码 → 计算中心 → 搜索 → 路线规划 → 排序
信息不足       → 针对缺失项追问 → 等待用户补充
只修改场所偏好 → 复用成员位置与中心 → 重新搜索、规划和排序
修改地址或城市 → 清除过期派生状态 → 重新地理编码和计算
```

这套状态转换既能避免“深圳的新请求继续显示苏州结果”，也能避免用户只换菜品时重复进行不必要的地址计算。

### 2. 可以解释的公平性目标

Centro 会为每一个候选地点计算：

```text
公平性分数 = 所有参与者路线时间的最大值
```

最大到达时间越小，排名越靠前。这个 minimax 目标关注通勤最不利的成员，避免平均值看起来很好、实际却让一个人承担大部分路程。总通勤时间和平均时间仍作为辅助信息展示。

如果某个候选点缺少任意一位参与者的完整路线，它不会通过伪造数值进入推荐列表；前端也会保护异常路线数据，不向用户展示 `Infinity` 或 `NaN`。

### 3. 在付费调用之前完成成本保护

公开接口会在调用大模型和高德地图之前完成输入校验、工作量限制、突发限制、单客户端日额度和全站日额度检查。Upstash Redis 使用原子计数，让多个 Vercel 实例共享同一份可靠额度。

如果 Redis、API 凭证或实时额度不可用，自定义搜索会保护性关闭，但零成本示例仍然可以体验。这样既保护 API Key，也不会让作品集在面试官访问时只剩一个错误页面。

### 4. 有回归测试支撑的工程行为

测试覆盖 Agent 地址状态复用与重算、不完整路线、原子额度、请求校验、北京时间自然日切换、移动端视口，以及 Vercel 自动生成的 Upstash 环境变量名兼容。

## Agent 如何工作

```text
自然语言聚会需求
  → 提取参与者、地址、城市和场所偏好
  → 对每个出发点进行地理编码
  → 计算共享搜索区域
  → 搜索附近候选场所
  → 规划每位参与者到每个候选点的路线
  → 按最慢到达时间排序
  → 流式展示地图、路线明细和推荐解释
```

LangGraph 主流程：

```text
START → parseInput
  ├─ 信息缺失 → 追问 → END
  ├─ 只修改偏好 → searchPoi
  └─ 新请求/地址变化 → geocode → computeCenter

searchPoi → planRoutes → rankResults → END
```

| 层级 | 职责 | 技术 |
|---|---|---|
| 交互界面 | 聊天、地图、推荐卡片和响应式视图 | Next.js 15、React 19、Tailwind CSS、Leaflet |
| API | 请求校验、共享额度和 SSE 传输 | Next.js Route Handler、Upstash Redis |
| Agent | 意图解析、追问、状态流转和公平排序 | LangGraph.js |
| 大模型 | 结构化意图提取 | DeepSeek OpenAI-compatible API |
| 地图服务 | 地理编码、POI 搜索、公交/驾车路线 | 高德地图 Web 服务 |
| 部署 | Serverless 运行与环境变量管理 | Vercel |

核心目录：

```text
app/api/agent/route.ts       请求保护与 SSE Agent 接口
lib/agent/graph.ts           LangGraph 工作流与公平性排序
lib/agent/limits.ts          参与者和候选地点成本边界
lib/demo/guard.ts            输入校验和客户端识别
lib/demo/quota.ts            Upstash 原子公共 Demo 额度
lib/demo/presets.ts          无需凭证的示例场景
lib/tools/amap.ts            高德地理编码、POI 和路线封装
app/components/MapView.tsx   地图可视化
```

## 支持范围

Centro 当前可靠支持的是**同城多地点聚会选址**，包括不同街区、不同城区的参与者。输入包含城市名的完整地址时，地理编码结果更可靠。

系统能够识别部分长距离输入，并根据路线距离展示驾车或高铁方向的出行提示，但这不等于已经实现完整跨城方案：目前没有接入铁路时刻表、车站换乘，也没有建立跨城市多式联运网络。因此，“真正的跨城多人会合优化”会放在 Roadmap 中，而不会包装成已经完成的能力。

## 快速开始

需要 Node.js 20 或更高版本、DeepSeek-compatible API Key，以及高德地图 Web 服务 Key。

```bash
git clone https://github.com/Dewenkings/centro.git
cd centro
npm install
cp .env.local.example .env.local
```

配置 `.env.local`：

```dotenv
LLM_API_KEY=your_deepseek_api_key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

AMAP_API_KEY=your_amap_web_service_key

UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token

DEMO_RATE_LIMIT_ENABLED=true
DEMO_DAILY_PER_IP=5
DEMO_DAILY_GLOBAL=30
DEMO_BURST_PER_IP=3
DEMO_BURST_WINDOW_SECONDS=600
```

启动开发环境：

```bash
npm run dev
```

打开 `http://localhost:3000`。示例场景不需要 Key；自定义实时搜索需要大模型、高德地图 Key，并在启用 Demo 限流时连接 Redis。

## 验证

```bash
npm test
npm run build
```

测试覆盖公开请求校验、原子日额度和突发额度、北京时间日期切换、故障保护、Agent 地址状态转换、路线完整性以及移动端布局。

## 部署与 API Key

Fork 项目的开发者应在自己的部署平台配置 Key。真实凭证只能保存在 `.env.local` 或部署平台管理的环境变量中，不能提交到 Git。

使用 Vercel 部署：

1. 导入 Fork 后的 GitHub 仓库。
2. 在 Project Settings → Environment Variables 配置 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` 和 `AMAP_API_KEY`。
3. 从 Vercel Marketplace 连接 Upstash Redis。应用同时兼容标准变量名和 Vercel 集成自动生成的带前缀变量名。
4. 保持下方 Demo 额度变量及其默认值启用。
5. 部署 `main` 分支。

公共 Demo 成本边界：

- 每次输入最多 300 个字符；
- 最多保留 20 条聊天记录；
- 一次最多 4 位参与者；
- 最多为 5 个候选场所规划路线；
- 每个客户端 IP 每个北京时间自然日最多接受 5 次实时搜索；
- 整个部署每个北京时间自然日最多接受 30 次实时搜索；
- 每个客户端 IP 在 10 分钟固定窗口内最多接受 3 次实时搜索。

三个 Redis 计数器会在调用付费服务之前进行原子检查。每日额度在北京时间零点重置。基于 IP 的匿名额度是一个有意保持简单的 Demo 方案：共享网络会共享额度，切换网络可能得到新的额度。

## 当前限制

- 为控制公共 Demo 成本，搜索有数量边界，不是穷举式场所抓取。
- 暂未处理预约余位、营业时间、饮食禁忌和实时拥堵。
- 尚未实现完整的跨城铁路时刻、车站换乘和多式联运规划。
- 实时搜索会把位置文本发送给已配置的大模型和地图服务；公开部署在收集真实用户数据前，应补充适合部署地区的隐私说明。

## Roadmap

- 基于时刻表的跨城与多式联运聚会规划
- 费用、评分、菜系和无障碍条件的权重配置
- 到达时间窗口与营业时间检查
- 可分享聚会方案、多人投票和登录用户分级额度
- 隐私友好的使用分析与排序质量评测集

## License

[MIT](./LICENSE)
