/**
 * Day 2 测试脚本：验证 LangGraph Agent 端到端流程
 * 运行方式：npx tsx scripts/test-agent.ts "我住在观前街，小明在阳澄湖，我们想找地方吃火锅"
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { graph } from "../lib/agent/graph";
import { GatherState } from "@/types";

async function main() {
  const inputText = process.argv[2] || "我住在观前街，小明在阳澄湖，我们想找地方吃火锅";

  console.log("🤖 Centro Agent 测试\n");
  console.log("用户输入:", inputText, "\n");

  const initialState: Partial<GatherState> = {
    conversationHistory: [{ role: "user", content: inputText }],
  };

  const result = await graph.invoke(initialState);

  console.log("\n📊 最终状态:");
  console.log("  状态:", result.status);
  console.log("  参与者:", result.participants.map((p) => `${p.name}(${p.address})→${p.location || "未解析"}`).join(", "));
  console.log("  关键词:", result.keywords);
  console.log("  中心点:", result.centerPoint);
  console.log("  候选数:", result.candidates.length);
  console.log("  路线数:", result.routes.length);
  console.log("  推荐数:", result.recommendations.length);

  if (result.missingInfo) {
    console.log("\n⚠️ 缺失信息:", result.missingInfo);
  }

  if (result.recommendations.length > 0) {
    console.log("\n🏆 推荐结果:\n");
    result.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.poi.name} — ${rec.poi.address}`);
      console.log(`   评分: ${rec.poi.rating || "暂无"} | 类型: ${rec.poi.type}`);
      rec.routes.forEach((r) => {
        console.log(`   → ${r.participantName}: ${r.duration_min}分钟, ${r.distance_km}km`);
      });
      console.log(`   总计: ${rec.totalDuration}分钟 | 最久: ${rec.maxDuration}分钟\n`);
    });
    console.log("✅ 测试通过！Agent 成功调用 4 个 Tool 并输出推荐");
  } else if (!result.missingInfo) {
    console.log("\n❌ 测试失败：未生成推荐结果");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ 测试出错:", err);
  process.exit(1);
});
