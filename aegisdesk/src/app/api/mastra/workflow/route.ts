/**
 * Mastra Workflow API
 * Execute complete incident management workflows with human interactions
 */

import { NextRequest, NextResponse } from "next/server";
import {
    triageAgent,
    remedyAgent,
    commsAgent,
    postMortemAgent,
} from "@/mastra/mastra";
import {
    createWorkflowState,
    getWorkflowState,
    updateWorkflowState,
    getAllWorkflowStates
} from "@/mastra/workflow-state";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/mastra/workflow
 * Start a new incident workflow
 * 
 * Body:
 * {
 *   incidentId: string,
 *   logs?: string,
 *   errorMessages?: string[],
 *   services?: string[],
 *   title?: string,
 *   severity?: number,
 *   waitForHumanApproval?: boolean (default: true)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            incidentId,
            logs,
            errorMessages,
            services,
            title,
            severity,
            waitForHumanApproval = true
        } = body;

        if (!incidentId) {
            return NextResponse.json(
                { error: "Missing required field: incidentId" },
                { status: 400 }
            );
        }

        const workflowId = uuidv4();

        // Create workflow state
        createWorkflowState(workflowId, { incidentId, title, severity });
        updateWorkflowState(workflowId, {
            status: "running",
            currentStep: 0,
            stepName: "starting",
        });

        console.log(`[Workflow API] Starting workflow ${workflowId} for incident ${incidentId}`);

        // Step 1: Run Triage Agent
        console.log(`[Workflow API] Step 1: Running Triage Agent`);
        const triageInput = {
            incidentId,
            logs,
            errorMessages,
            services,
        };

        const triageResult = await triageAgent.generate([
            { role: "user", content: JSON.stringify(triageInput) },
        ]);

        const triageOutput = triageResult.text || triageResult.content;
        let triageData;
        try {
            triageData = JSON.parse(triageOutput);
        } catch {
            triageData = { rawOutput: triageOutput };
        }

        // Store triage results
        updateWorkflowState(workflowId, {
            currentStep: 1,
            stepName: "triage",
            results: { triage: triageData },
        });

        // If waiting for human approval after triage
        if (waitForHumanApproval) {
            updateWorkflowState(workflowId, {
                status: "awaiting_human",
                pausedAt: "triage",
            });

            return NextResponse.json({
                workflowId,
                status: "awaiting_human",
                currentStep: 1,
                stepName: "triage",
                message: "Triage completed. Human approval required to proceed to remediation.",
                triageResult: triageData,
                approvalRequired: true,
                approvalEndpoint: `/api/mastra/workflow/${workflowId}/approve`,
            });
        }

        // Step 2: Run Remedy Agent
        console.log(`[Workflow API] Step 2: Running Remedy Agent`);
        const remedyInput = {
            incidentId,
            rootCause: triageData.rootCause || triageData.rawOutput,
            recommendations: triageData.recommendations || [],
        };

        const remedyResult = await remedyAgent.generate([
            { role: "user", content: JSON.stringify(remedyInput) },
        ]);

        const remedyOutput = remedyResult.text || remedyResult.content;
        let remedyData;
        try {
            remedyData = JSON.parse(remedyOutput);
        } catch {
            remedyData = { rawOutput: remedyOutput };
        }

        updateWorkflowState(workflowId, {
            currentStep: 2,
            stepName: "remedy",
            results: { triage: triageData, remedy: remedyData },
        });

        if (waitForHumanApproval) {
            updateWorkflowState(workflowId, {
                status: "awaiting_human",
                pausedAt: "remedy",
            });

            return NextResponse.json({
                workflowId,
                status: "awaiting_human",
                currentStep: 2,
                stepName: "remedy",
                message: "Remediation steps generated. Human approval required to proceed to communications.",
                triageResult: triageData,
                remedyResult: remedyData,
                approvalRequired: true,
                approvalEndpoint: `/api/mastra/workflow/${workflowId}/approve`,
            });
        }

        // Step 3: Run Comms Agent
        console.log(`[Workflow API] Step 3: Running Comms Agent`);
        const commsInput = {
            incidentId,
            title: title || `Incident ${incidentId}`,
            severity: severity || triageData.severity || 2,
            status: "Active",
            rootCause: triageData.rootCause,
            affectedServices: triageData.affectedServices || services,
        };

        const commsResult = await commsAgent.generate([
            { role: "user", content: JSON.stringify(commsInput) },
        ]);

        const commsOutput = commsResult.text || commsResult.content;
        let commsData;
        try {
            commsData = JSON.parse(commsOutput);
        } catch {
            commsData = { rawOutput: commsOutput };
        }

        updateWorkflowState(workflowId, {
            currentStep: 3,
            stepName: "comms",
            results: { triage: triageData, remedy: remedyData, comms: commsData },
        });

        // Step 4: Run PostMortem Agent
        console.log(`[Workflow API] Step 4: Running PostMortem Agent`);
        const postMortemInput = {
            incidentId,
            title: title || `Incident ${incidentId}`,
            severity: severity || triageData.severity || 2,
            status: "Resolved",
            rootCause: triageData.rootCause,
            resolution: remedyData.resolution || "Issue resolved through automated remediation",
        };

        const postMortemResult = await postMortemAgent.generate([
            { role: "user", content: JSON.stringify(postMortemInput) },
        ]);

        const postMortemOutput = postMortemResult.text || postMortemResult.content;
        let postMortemData;
        try {
            postMortemData = JSON.parse(postMortemOutput);
        } catch {
            postMortemData = { rawOutput: postMortemOutput };
        }

        updateWorkflowState(workflowId, {
            currentStep: 4,
            stepName: "completed",
            status: "completed",
            results: {
                triage: triageData,
                remedy: remedyData,
                comms: commsData,
                postmortem: postMortemData
            },
        });

        console.log(`[Workflow API] Workflow ${workflowId} completed successfully`);

        return NextResponse.json({
            workflowId,
            status: "completed",
            currentStep: 4,
            results: {
                triage: triageData,
                remedy: remedyData,
                comms: commsData,
                postmortem: postMortemData,
            },
        });
    } catch (error) {
        console.error("[Workflow API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/mastra/workflow
 * Get all workflow states
 */
export async function GET() {
    const workflows = getAllWorkflowStates();

    return NextResponse.json({
        workflows,
        count: workflows.length,
    });
}
