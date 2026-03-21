import { NextRequest, NextResponse } from "next/server";
import { runPostMortem } from "@/mastra/agents/postMort2";

/**
 * POST /api/agents/postmortem
 * Run PostMort-2 agent for post-mortem generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incidentId, title, severity, status, rootCause, timeline, resolution } = body;

    if (!incidentId || !title) {
      return NextResponse.json(
        { error: "Missing required fields: incidentId, title" },
        { status: 400 }
      );
    }

    console.log(`[API] Running PostMort-2 for incident: ${incidentId}`);

    const result = await runPostMortem({
      incidentId,
      title,
      severity: severity || 2,
      status: status || "Resolved",
      rootCause,
      timeline,
      resolution,
    });

    return NextResponse.json({
      success: true,
      agent: "PostMort-2",
      result,
    });
  } catch (error) {
    console.error("[API] PostMort-2 error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
