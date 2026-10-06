import { currentGeminiModel } from "@/lib/agent/run";
import { qlooMode } from "@/lib/qloo/client";

export async function GET() {
  return Response.json({ qloo: qlooMode(), llm: process.env.GEMINI_API_KEY ? currentGeminiModel() ?? "autopilot" : "autopilot" });
}
