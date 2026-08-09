<div align="center">

# Centro

### AI 多人公平聚会选址助手

**找到符合聚会偏好、又不让某一个人横穿整座城市的见面地点。**

用自然语言描述每个人从哪里出发、大家想吃什么或做什么。Centro 会理解需求、搜索候选场所、比较真实通勤时间，并在地图上解释更公平的选择。

![Next.js](https://img.shields.io/badge/Next.js-15-111827?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent-0F766E)
![高德地图](https://img.shields.io/badge/高德地图-Web服务-1677FF)

[在线体验](https://centro-nine.vercel.app/) · [English](./README.md) · [体验示例场景](#零成本示例场景) · [快速开始](#快速开始) · [产品设计](./docs/superpowers/specs/2026-08-09-public-demo-portfolio-design.md)

</div>

---

## 为什么做 Centro

多人聚餐选址看似简单，真正讨论时却经常变成反复搜索和比较路线：

- **群聊协调成本高。** 一个人找餐厅，所有人分别查路线，换一种餐饮偏好后又要重来。
- **地理中点不等于公平地点。** 河流、道路结构、地铁换乘和拥堵，会让相同直线距离产生完全不同的通勤时间。
- **出行公平与场所偏好互相制约。** 最靠近中心的位置，未必有大家真正想去的餐厅或活动。
- **传统推荐缺少解释。** 用户需要知道每个人要走多远，以及第一名为什么比其他候选点更公平。

Centro 把这类群聊协调问题转换成一个可以理解、可以检查、也可以继续修改的推荐流程。

## 工作方式

```text
自然语言聚会需求
  → 提取参与者、地址、城市和场所偏好
  → 对每个出发位置进行地理编码
  → 计算共享搜索区域
  → 搜索附近候选场所
  → 规划每位参与者到每个候选点的路线
  → 按最慢到达时间排序
  → 展示地图、路线明细和推荐解释
```

核心公平性指标保持简单、透明：

```text
公平性分数 = 所有参与者通勤时间的最大值
```

最小化最大通勤时间，可以避免“平均值看起来不错，但其中一个人承担了绝大多数路程”的情况。总通勤时间仍会作为辅助信息展示。

## 功能特性

| 能力 | 说明 |
|---|---|
| 自然语言理解 | 从中文对话中提取参与者、位置、城市和聚会偏好 |
| 多轮信息补全 | 信息不足时主动追问，而不是直接返回失败 |
| 约束迭代 | 支持“换成日料”等追问，无需重新输入全部地址 |
| 真实路线比较 | 使用高德地理编码、POI 搜索和路线规划，不只比较直线距离 |
| 公平性优先排序 | 按最慢参与者的到达时间对候选地点排序 |
| Agent 流式进度 | 通过 SSE 展示定位、搜索、路线规划和排序过程 |
| 可解释地图结果 | 展示参与者、中心区域、候选地点和每个人的路线信息 |
| 移动端结果视图 | 手机上可以在对话和地图结果之间切换 |

## 零成本示例场景

首次打开页面可以选择标注为“无需 API · 示例数据”的「苏州双人火锅」场景。它会直接填充正常的聊天、地图和推荐状态，不调用大模型或高德 Web 服务。

这样即使在线 API 暂时没有额度，作品集访客依然可以完整理解结果体验。页面会明确标注示例数据，不会把它伪装成实时搜索结果。

真实在线搜索可以输入：

```text
我住观前街，小明住阳澄湖，想吃火锅
```

然后继续修改：

```text
换成日料
```

## 技术架构

| 层级 | 职责 | 技术 |
|---|---|---|
| 交互界面 | 聊天、地图、推荐卡片和响应式视图 | Next.js 15、React 19、Tailwind CSS、Leaflet |
| API | 请求校验、基础限流和 SSE 传输 | Next.js Route Handler |
| Agent | 意图解析、追问、状态流转和排序 | LangGraph.js |
| 大模型 | 结构化意图提取 | DeepSeek OpenAI-compatible API |
| 地图服务 | 地理编码、POI 搜索、公交/驾车路线 | 高德地图 Web 服务 |

Agent 主流程：

```text
START → parseInput
  ├─ 信息缺失 → 追问 → END
  ├─ 修改偏好 → searchPoi
  └─ 新请求/补充信息 → geocode → computeCenter

searchPoi → planRoutes → rankResults → END
```

核心目录：

```text
app/api/agent/route.ts       请求保护与 SSE Agent 接口
lib/agent/graph.ts           LangGraph 工作流与公平性排序
lib/agent/limits.ts          参与者和候选地点数量边界
lib/demo/guard.ts            输入校验和基础限流
lib/demo/presets.ts          无需凭证的示例场景
lib/tools/amap.ts            高德地理编码、POI 和路线封装
app/components/MapView.tsx   地图可视化
```

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

DEMO_RATE_LIMIT_ENABLED=true
DEMO_RATE_LIMIT_REQUESTS=5
DEMO_RATE_LIMIT_WINDOW_MS=600000
```

启动开发环境：

```bash
npm run dev
```

打开 `http://localhost:3000`。示例场景不需要 Key；自定义实时搜索需要同时配置大模型和高德 Key。

## 验证

```bash
npm test
npm run build
```

测试覆盖公开请求校验、固定窗口限流，以及 Agent 成本边界。

## 部署与 API Key

Fork 项目的开发者应在自己的部署平台配置 Key。真实凭证只能保存在 `.env.local` 或部署平台管理的环境变量中，不能提交到 Git。

使用 Vercel 部署：

1. 导入 Fork 后的 GitHub 仓库。
2. 在 Project Settings → Environment Variables 配置 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` 和 `AMAP_API_KEY`。
3. 保持 Demo 限流变量开启。
4. 部署 `main` 分支。

应用本身还包含以下成本边界：

- 每次输入最多 300 个字符；
- 最多保留 20 条聊天记录；
- 一次最多 4 位参与者；
- 最多为 5 个候选场所规划路线；
- 默认每位访客 10 分钟内最多提交 5 次自定义请求。

仓库内限流是**进程内 best-effort 防护**。Serverless 实例之间不共享内存，正式公开部署还应配置 Vercel Firewall 限流，或接入持久化的边缘/存储型限流。实时 Key 或额度不可用时，示例场景仍然可以体验。

## 当前限制

- 当前主要优化同一城市内的聚会场景，跨城市推荐需要不同的交通模型。
- 为控制公共 Demo 成本，路线规划有数量上限，不是穷举式餐厅搜索。
- 暂未处理预约余位、营业时间、饮食禁忌和实时拥堵。
- 进程内限流不能替代部署平台的滥用防护。
- 实时搜索会把位置文本发送给已配置的大模型和地图服务；在收集真实用户数据前，应补充适合部署地区的隐私说明。

## Roadmap

- 费用、评分、菜系和无障碍条件的权重配置
- 可分享聚会方案和多人投票
- 到达时间窗口与营业时间检查
- 持久化分布式限流和匿名使用分析
- 意图解析与排序质量评测集

## License

[MIT](./LICENSE)
