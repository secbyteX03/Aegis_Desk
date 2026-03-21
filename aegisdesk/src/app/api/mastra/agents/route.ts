/**
 * Mastra Agents API
 * Unified endpoint for running Mastra agents with full workflow support
 */

import { NextRequest, NextResponse } from "next/server";
import {
    triageAgent,
    remedyAgent,
    commsAgent,
    postMortemAgent,
    tools
} from "@/mastra/mastra";

/**
 * POST /api/mastra/agents
 * Run a Mastra agent with the specified input
 * 
 * Body:
 * {
 *   agent: "triage" | "remedy" | "comms" | "postmortem",
 *   input: {...},
 *   useTools: boolean (optional, default: true)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { agent: agentType, input, useTools = true } = body;

        if (!agentType || !input) {
            return NextResponse.json(
                { error: "Missing required fields: agent, input" },
                { status: 400 }
            );
        }

        // Select the agent
        const agentMap: Record<string, any> = {
            triage: triageAgent,
            remedy: remedyAgent,
            comms: commsAgent,
            postmortem: postMortemAgent,
        };

        const agent = agentMap[agentType];
        if (!agent) {
            return NextResponse.json(
                { error: `Unknown agent type: ${agentType}. Available: triage, remedy, comms, postmortem` },
                { status: 400 }
            );
        }

        console.log(`[Mastra API] Running agent: ${agentType}`);
        console.log(`[Mastra API] Input:`, JSON.stringify(input));

        // Run the agent with Mastra's generate method
        const result = await agent.generate([
            {
                role: "user",
                content: typeof input === "string" ? input : JSON.stringify(input),
            },
        ]);

        const output = result.text || result.content;

        console.log(`[Mastra API] Agent ${agentType} completed successfully`);

        return NextResponse.json({
            success: true,
            agent: agentType,
            output: output,
            toolCalls: result.toolCalls || [],
        });
    } catch (error) {
        console.error("[Mastra API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/mastra/agents
 * Get information about available agents
 */
export async function GET() {
    return NextResponse.json({
        agents: [
            {
                id: "triage-7",
                name: "Triage-7",
                description: "Log analysis and root cause identification",
                capabilities: ["log analysis", "pattern recognition", "root cause identification", "severity assessment"],
            },
            {
                id: "remedy-3",
                name: "Remedy-3",
                description: "Runbook execution and remediation",
                capabilities: ["runbook execution", "remediation automation", "step-by-step guidance", "fix verification"],
            },
            {
                id: "comms-1",
                name: "Comms-1",
                description: "Stakeholder communications",
                capabilities: ["status page updates", "email notifications", "Slack notifications", "stakeholder management"],
            },
            {
                id: "postmortem-2",
                name: "PostMort-2",
                description: "Post-mortem documentation",
                capabilities: ["post-mortem generation", "timeline analysis", "lesson extraction", "action item tracking"],
            },
        ],
        tools: Object.keys(tools),
        message: "Use POST to run an agent",
    });
}
