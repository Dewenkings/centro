# Centro - AI 多人聚会地点推荐

基于 LangGraph.js + DeepSeek LLM + 高德地图 API 的智能聚会选址助手。支持自然语言输入、多轮对话追问、约束迭代修改推荐结果。

## 功能特性

- **自然语言理解**：输入"我住在观前街，小明在阳澄湖，想吃火锅"即可自动解析参与人、地址、关键词
- **多轮对话**：信息不足时自动追问（如缺少城市名）
- **约束迭代**：无需重复输入地址，直接说"换成日料"即可更新推荐
- **智能出行建议**：根据距离自动推荐出行方式（步行、公交、驾车、高铁）
- **可视化地图**：Leaflet 地图展示参与者位置、中心点和推荐 POI
- **路线规划**：为每个参与者计算到推荐地点的路线距离和耗时

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 15 + React 19 + Tailwind CSS + Leaflet |
| Agent 框架 | LangGraph.js (StateGraph) |
| LLM | DeepSeek (OpenAI-compatible API) |
| 地图服务 | 高德地图 Web服务 API |
| 部署 | Vercel |

## 快速开始

```bash
# 1. 克隆项目
git clone <repo-url>
cd centro

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 DeepSeek API Key 和高德 Key

# 4. 开发运行
npm run dev
# 打开 http://localhost:3000
```

## 项目结构

```
├── app/                    # Next.js App Router
│   ├── api/agent/route.ts  # Agent API 入口
│   ├── components/         # React 组件
│   ├── page.tsx            # 主页面（地图 + 聊天）
│   └── layout.tsx
├── lib/
│   ├── agent/graph.ts      # LangGraph Agent 核心
│   ├── tools/amap.ts       # 高德地图 API 封装
│   └── llm.ts              # DeepSeek LLM 客户端
├── types/index.ts          # TypeScript 类型定义
└── scripts/test-agent.ts   # Agent 测试脚本
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `LLM_API_KEY` | DeepSeek API Key |
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | `deepseek-chat` |
| `AMAP_API_KEY` | 高德地图 Web服务 Key |

## Agent 工作流

```
用户输入
  → parseInput (LLM 意图识别)
    ├─ missingInfo → 追问用户 → END
    ├─ iterate → 换关键词 → searchPoi → ... → END
    ├─ clarify → 合并信息 → geocode → ... → END
    └─ new → geocode → computeCenter → searchPoi
         → planRoutes → rankResults → END
```

## 开发

```bash
# 运行 Agent 测试
npx tsx scripts/test-agent.ts

# 构建
npm run build
```

## 部署

本项目配置为 `output: "standalone"`，可直接部署到 Vercel：

```bash
npm i -g vercel
vercel --prod
```

或在 Vercel Dashboard 中导入 GitHub 仓库，配置环境变量后自动部署。

## License

MIT
