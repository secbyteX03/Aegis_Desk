import { NextRequest, NextResponse } from "next/server";
import { runRemedy } from "@/mastra/agents/remedy3";

/**
 * POST /api/agents/remedy
 * Run Remedy-3 agent for runbook execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incidentId, rootCause, recommendations } = body;

    if (!incidentId || !rootCause) {
      return NextResponse.json(
        { error: "Missing required fields: incidentId, rootCause" },
        { status: 400 }
      );
    }

    console.log(`[API] Running Remedy-3 for incident: ${incidentId}`);

    const result = await runRemedy({
      incidentId,
      rootCause,
      recommendations,
    });

    return NextResponse.json({
      success: true,
      agent: "Remedy-3",
      result,
    });
  } catch (error) {
    console.error("[API] Remedy-3 error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
