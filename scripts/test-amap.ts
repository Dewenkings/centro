/**
 * Day 1 测试脚本：验证 4 个高德 API 是否正常工作
 * 运行方式：npx tsx scripts/test-amap.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { geocode, searchNearbyPois, routePlan, computeCentroid } from "../lib/tools/amap";

async function main() {
  console.log("🧪 Centro 高德 API 测试\n");

  // 1. 地理编码
  console.log("1️⃣ 地理编码：观前街、阳澄湖");
  const loc1 = await geocode("观前街", "苏州");
  const loc2 = await geocode("阳澄湖", "苏州");
  console.log("  观前街:", loc1);
  console.log("  阳澄湖:", loc2);

  if ("error" in loc1 || "error" in loc2) {
    console.error("❌ 地理编码失败，终止测试");
    return;
  }

  // 2. 计算中心点
  console.log("\n2️⃣ 计算地理中心");
  const center = computeCentroid([loc1.location, loc2.location]);
  console.log("  中心点:", center);

  // 3. POI 搜索
  console.log("\n3️⃣ 搜索附近火锅");
  const pois = await searchNearbyPois(center, "火锅", 5000, 5);
  console.log("  结果:", pois);

  if ("error" in pois || !pois.pois?.length) {
    console.error("❌ POI 搜索失败或无结果");
    return;
  }

  // 4. 路径规划（从观前街到第一个候选店）
  console.log("\n4️⃣ 路径规划：观前街 →", pois.pois[0].name);
  const route = await routePlan(loc1.location, pois.pois[0].location, "transit", "苏州");
  console.log("  结果:", route);

  console.log("\n✅ 全部测试通过！");
}

main().catch(console.error);
