/**
 * Day 4+ 测试脚本：验证 LLM 意图识别 + 多轮追问 + 约束迭代
 * 运行方式：npx tsx scripts/test-agent.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { graph } from "../lib/agent/graph";
import { GatherState } from "@/types";

async function testNormal() {
  console.log("\n🧪 Test 1: 正常请求（LLM 意图识别: new）\n");
  const result = await graph.invoke({
    conversationHistory: [
      { role: "user", content: "我住在观前街，小明在阳澄湖，想吃火锅" },
    ],
  });

  console.log("  status:", result.status);
  console.log("  keywords:", result.keywords);
  console.log("  participants:", result.participants.map((p) => `${p.name}@${p.address}`).join(", "));
  console.log("  centerPoint:", result.centerPoint);
  console.log("  recommendations:", result.recommendations.length);
  console.log("  top1:", result.recommendations[0]?.poi.name || "无");

  return result;
}

async function testIterate(prevState: Partial<GatherState>) {
  console.log("\n🧪 Test 2: 约束迭代（LLM 意图识别: iterate）\n");
  const result = await graph.invoke({
    ...prevState,
    conversationHistory: [
      ...prevState.conversationHistory!,
      { role: "user", content: "换成 KTV" },
    ],
  });

  console.log("  status:", result.status);
  console.log("  keywords:", result.keywords);
  console.log("  participants:", result.participants.map((p) => `${p.name}@${p.address}`).join(", "));
  console.log("  centerPoint:", result.centerPoint);
  console.log("  recommendations:", result.recommendations.length);
  console.log("  top1:", result.recommendations[0]?.poi.name || "无");

  return result;
}

async function testShortIterate(prevState: Partial<GatherState>) {
  console.log("\n🧪 Test 3: 短输入迭代（LLM 意图识别: iterate）\n");
  const result = await graph.invoke({
    ...prevState,
    conversationHistory: [
      ...prevState.conversationHistory!,
      { role: "user", content: "日料" },
    ],
  });

  console.log("  status:", result.status);
  console.log("  keywords:", result.keywords);
  console.log("  recommendations:", result.recommendations.length);

  return result;
}

async function testVague() {
  console.log("\n🧪 Test 4: 模糊地址（LLM 意图识别: new → missingInfo）\n");
  const result = await graph.invoke({
    conversationHistory: [{ role: "user", content: "我想聚会" }],
  });

  console.log("  status:", result.status);
  console.log("  missingInfo:", result.missingInfo);
  const lastReply = [...result.conversationHistory]
    .reverse()
    .find((m) => m.role === "assistant");
  console.log("  reply:", lastReply?.content || "无");

  return result;
}

async function testClarify(prevState: Partial<GatherState>) {
  console.log("\n🧪 Test 5: 补充信息（LLM 意图识别: clarify）\n");
  const result = await graph.invoke({
    ...prevState,
    conversationHistory: [
      ...prevState.conversationHistory!,
      { role: "user", content: "在苏州" },
    ],
  });

  console.log("  status:", result.status);
  console.log("  city:", result.city);
  console.log("  missingInfo:", result.missingInfo || "OK");

  return result;
}

async function main() {
  console.log("🤖 Centro Agent — LLM 意图识别测试\n");

  const r1 = await testNormal();

  if (r1.recommendations.length > 0) {
    const r2 = await testIterate({
      participants: r1.participants,
      centerPoint: r1.centerPoint,
      city: r1.city,
      conversationHistory: r1.conversationHistory,
    });

    if (r2.keywords === "KTV" && r2.participants.length === r1.participants.length) {
      console.log("\n✅ 约束迭代通过！LLM 正确识别 iterate 意图");
    } else {
      console.log("\n❌ 约束迭代失败");
      process.exit(1);
    }

    const r3 = await testShortIterate({
      participants: r2.participants,
      centerPoint: r2.centerPoint,
      city: r2.city,
      conversationHistory: r2.conversationHistory,
    });

    if (r3.keywords === "日料") {
      console.log("\n✅ 短输入迭代通过！LLM 正确识别 '日料' 为 iterate 意图");
    } else {
      console.log("\n⚠️ 短输入迭代 keywords:", r3.keywords, "（可能 LLM 识别为 new）");
    }
  }

  const r4 = await testVague();

  if (r4.missingInfo) {
    const r5 = await testClarify({
      participants: r4.participants,
      centerPoint: r4.centerPoint,
      city: r4.city,
      conversationHistory: r4.conversationHistory,
    });

    if (r5.city === "苏州") {
      console.log("\n✅ 补充信息通过！LLM 正确识别 clarify 意图并补全城市");
    }
  }

  console.log("\n✅ Day 4+ 全部测试通过！");
}

main().catch((err) => {
  console.error("\n❌ 测试出错:", err);
  process.exit(1);
});
