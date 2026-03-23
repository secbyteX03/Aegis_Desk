/**
 * Mastra Workflow Approval API
 * Human interaction endpoint for approving/rejecting workflow steps
 */

import { NextRequest, NextResponse } from "next/server";
import {
    triageAgent,
    remedyAgent,
    commsAgent,
    postMortemAgent
} from "@/mastra/mastra";
import {
    getWorkflowState,
    updateWorkflowState
} from "@/mastra/workflow-state";

/**
 * POST /api/mastra/workflow/[workflowId]/approve
 * Approve or reject a workflow step and continue execution
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> }
) {
    try {
        const { workflowId } = await params;
        const body = await request.json();
        const { action, approvalNotes } = body; // action: "approve" | "reject"

        if (!action || !["approve", "reject"].includes(action)) {
            return NextResponse.json(
                { error: "Missing or invalid field: action (must be 'approve' or 'reject')" },
                { status: 400 }
            );
        }

        const workflowState = getWorkflowState(workflowId);
        if (!workflowState) {
            return NextResponse.json(
                { error: `Workflow not found: ${workflowId}` },
                { status: 404 }
            );
        }

        if (workflowState.status !== "awaiting_human") {
            return NextResponse.json(
                { error: `Workflow is not awaiting human approval. Current status: ${workflowState.status}` },
                { status: 400 }
            );
        }

        if (action === "reject") {
            updateWorkflowState(workflowId, {
                status: "failed",
            });

            return NextResponse.json({
                workflowId,
                status: "failed",
                message: "Workflow rejected by human",
                notes: approvalNotes,
            });
        }

        // Action is "approve" - continue workflow
        console.log(`[Workflow Approval] Workflow ${workflowId} approved at step ${workflowState.pausedAt}`);

        const triageData = workflowState.results.triage;
        const incidentId = triageData?.incidentId || workflowState.metadata?.incidentId || "unknown";

        // Get incident details from triage results
        const title = triageData?.title || workflowState.metadata?.title || `Incident ${incidentId}`;
        const severity = triageData?.severity || workflowState.metadata?.severity || 2;
        const services = triageData?.affectedServices || [];

        // Continue from where we paused
        if (workflowState.pausedAt === "triage") {
            // Step 2: Run Remedy Agent
            console.log(`[Workflow API] Step 2 (continued): Running Remedy Agent`);

            const remedyInput = {
                incidentId,
                rootCause: triageData?.rootCause || triageData?.rawOutput,
                recommendations: triageData?.recommendations || [],
            };

            const remedyResult = await remedyAgent.generate([
                { role: "user", content: JSON.stringify(remedyInput) },
            ]);

            const remedyOutput = (remedyResult as any).text;
            let remedyData;
            try {
                remedyData = JSON.parse(remedyOutput);
            } catch {
                remedyData = { rawOutput: remedyOutput };
            }

            const currentResults = { ...workflowState.results, remedy: remedyData };
            updateWorkflowState(workflowId, {
                currentStep: 2,
                stepName: "remedy",
                pausedAt: "remedy",
                status: "awaiting_human",
                results: currentResults,
            });

            return NextResponse.json({
                workflowId,
                status: "awaiting_human",
                currentStep: 2,
                stepName: "remedy",
                message: "Remediation completed. Human approval required to proceed to communications.",
                triageResult: triageData,
                remedyResult: remedyData,
                approvalRequired: true,
                approvalEndpoint: `/api/mastra/workflow/${workflowId}/approve`,
            });
        }

        if (workflowState.pausedAt === "remedy") {
            // Step 3: Run Comms Agent
            console.log(`[Workflow API] Step 3 (continued): Running Comms Agent`);

            const commsInput = {
                incidentId,
                title,
                severity,
                status: "Active",
                rootCause: triageData?.rootCause,
                affectedServices: services,
            };

            const commsResult = await commsAgent.generate([
                { role: "user", content: JSON.stringify(commsInput) },
            ]);

            const commsOutput = (commsResult as any).text;
            let commsData;
            try {
                commsData = JSON.parse(commsOutput);
            } catch {
                commsData = { rawOutput: commsOutput };
            }

            const currentResults = { ...workflowState.results, comms: commsData };
            updateWorkflowState(workflowId, {
                currentStep: 3,
                stepName: "comms",
                results: currentResults,
            });

            // Step 4: Run PostMortem Agent
            console.log(`[Workflow API] Step 4 (continued): Running PostMortem Agent`);

            const postMortemInput = {
                incidentId,
                title,
                severity,
                status: "Resolved",
                rootCause: triageData?.rootCause,
                resolution: "Issue resolved through automated remediation",
            };

            const postMortemResult = await postMortemAgent.generate([
                { role: "user", content: JSON.stringify(postMortemInput) },
            ]);

            const postMortemOutput = (postMortemResult as any).text;
            let postMortemData;
            try {
                postMortemData = JSON.parse(postMortemOutput);
            } catch {
                postMortemData = { rawOutput: postMortemOutput };
            }

            const finalResults = {
                ...currentResults,
                postmortem: postMortemData
            };

            updateWorkflowState(workflowId, {
                currentStep: 4,
                stepName: "completed",
                status: "completed",
                results: finalResults,
            });

            return NextResponse.json({
                workflowId,
                status: "completed",
                currentStep: 4,
                results: {
                    triage: triageData,
                    remedy: workflowState.results.remedy,
                    comms: commsData,
                    postmortem: postMortemData,
                },
                approvalNotes,
            });
        }

        return NextResponse.json({
            error: "Unknown workflow pause state",
            workflowId,
            pausedAt: workflowState.pausedAt,
        }, { status: 500 });
    } catch (error) {
        console.error("[Workflow Approval API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/mastra/workflow/[workflowId]/approve
 * Get workflow approval status
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> }
) {
    try {
        const { workflowId } = await params;
        const workflowState = getWorkflowState(workflowId);

        if (!workflowState) {
            return NextResponse.json(
                { error: `Workflow not found: ${workflowId}` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            workflowId,
            status: workflowState.status,
            currentStep: workflowState.currentStep,
            stepName: workflowState.stepName,
            pausedAt: workflowState.pausedAt,
            results: workflowState.results,
            approvalRequired: workflowState.status === "awaiting_human",
        });
    } catch (error) {
        console.error("[Workflow Approval API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
