import { NextRequest, NextResponse } from "next/server";
import { runComms } from "@/mastra/agents/comms1";

/**
 * POST /api/agents/comms
 * Run Comms-1 agent for stakeholder communications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incidentId, title, severity, status, rootCause, affectedServices, recipients } = body;

    if (!incidentId || !title) {
      return NextResponse.json(
        { error: "Missing required fields: incidentId, title" },
        { status: 400 }
      );
    }

    console.log(`[API] Running Comms-1 for incident: ${incidentId}`);

    const result = await runComms({
      incidentId,
      title,
      severity: severity || 2,
      status: status || "Active",
      rootCause,
      affectedServices,
      recipients,
    });

    return NextResponse.json({
      success: true,
      agent: "Comms-1",
      result,
    });
  } catch (error) {
    console.error("[API] Comms-1 error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
