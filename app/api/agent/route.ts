import type { NextRequest } from "next/server";
import { handleAgentRequest } from "@/lib/demo/agent-handler";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handleAgentRequest(request);
}
