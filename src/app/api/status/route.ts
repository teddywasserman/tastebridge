import { GEMINI_MODEL } from "@/lib/agent/run";
import { qlooMode } from "@/lib/qloo/client";

export async function GET() {
  return Response.json({ qloo: qlooMode(), llm: process.env.GEMINI_API_KEY ? GEMINI_MODEL : "autopilot" });
}
