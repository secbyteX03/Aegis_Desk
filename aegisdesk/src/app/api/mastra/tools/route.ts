/**
 * Mastra Tools API
 * List and execute available Mastra tools
 */

import { NextRequest, NextResponse } from "next/server";
import { tools } from "@/mastra/mastra";

/**
 * GET /api/mastra/tools
 * Get list of available tools
 */
export async function GET() {
    const toolList = Object.entries(tools).map(([name, tool]) => ({
        name,
        id: tool.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
    }));

    return NextResponse.json({
        tools: toolList,
        count: toolList.length,
    });
}

/**
 * POST /api/mastra/tools
 * Execute a specific tool
 * 
 * Body:
 * {
 *   toolName: string,
 *   input: {...}
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { toolName, input } = body;

        if (!toolName || !input) {
            return NextResponse.json(
                { error: "Missing required fields: toolName, input" },
                { status: 400 }
            );
        }

        const tool = tools[toolName as keyof typeof tools];
        if (!tool) {
            return NextResponse.json(
                { error: `Tool not found: ${toolName}. Available tools: ${Object.keys(tools).join(", ")}` },
                { status: 400 }
            );
        }

        console.log(`[Tools API] Executing tool: ${toolName}`);
        console.log(`[Tools API] Input:`, input);

        // Execute the tool
        const result = await tool.execute({ context: input });

        console.log(`[Tools API] Tool ${toolName} executed successfully`);

        return NextResponse.json({
            success: true,
            toolName,
            result,
        });
    } catch (error) {
        console.error("[Tools API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
