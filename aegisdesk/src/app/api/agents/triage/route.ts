import { NextRequest, NextResponse } from "next/server";
import { runTriage } from "@/mastra/agents/triage7";

/**
 * POST /api/agents/triage
 * Run Triage-7 agent for log analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incidentId, logs, errorMessages, services } = body;

    if (!incidentId) {
      return NextResponse.json(
        { error: "Missing required field: incidentId" },
        { status: 400 }
      );
    }

    console.log(`[API] Running Triage-7 for incident: ${incidentId}`);

    const result = await runTriage({
      incidentId,
      logs,
      errorMessages,
      services,
    });

    return NextResponse.json({
      success: true,
      agent: "Triage-7",
      result,
    });
  } catch (error) {
    console.error("[API] Triage-7 error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
