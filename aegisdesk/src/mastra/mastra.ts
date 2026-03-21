/**
 * Mastra Configuration for AegisDesk
 * Proper Mastra v0.8.x implementation with Agents, Tools, Workflows, and Human Interactions
 */

import { Agent, Workflow, Memory, createTool } from "@mastra/core";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Initialize Google Gemini using AI SDK v4's model wrapper
// This ensures compatibility with AI SDK 4's specification version "v1"
const geminiModel = google("gemini-2.0-flash", {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Initialize OpenAI model as fallback
const openaiModel = openai("gpt-4o-mini", {
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper to get model - tries Gemini first, falls back to OpenAI
function getModel() {
    const useOpenAI = process.env.USE_OPENAI === "true";
    if (useOpenAI) {
        console.log("[Mastra] Using OpenAI model");
        return openaiModel;
    }
    console.log("[Mastra] Using Gemini model");
    return geminiModel;
}

// ============================================
// TOOLS - Database Operations
// ============================================

// Fetch Incidents Tool
export const fetchIncidentsTool = createTool({
    id: "fetchIncidents",
    description: "Fetch incidents from the database",
    inputSchema: z.object({
        limit: z.number().optional().default(50),
    }),
    outputSchema: z.object({
        incidents: z.array(z.unknown()),
        count: z.number(),
    }),
    execute: async ({ context }) => {
        try {
            const { sql, isNeonConfigured } = await import("@/lib/neon/client");
            if (!isNeonConfigured()) {
                return { incidents: [], count: 0 };
            }
            const result = await sql`SELECT * FROM incidents ORDER BY created_at DESC LIMIT ${context.limit || 50}`;
            return { incidents: result, count: result.length };
        } catch (error) {
            console.error("[Tool] fetchIncidents error:", error);
            return { incidents: [], count: 0, error: String(error) };
        }
    },
});

// Fetch Incident by ID Tool
export const fetchIncidentTool = createTool({
    id: "fetchIncident",
    description: "Fetch a single incident by ID",
    inputSchema: z.object({
        id: z.string(),
    }),
    outputSchema: z.object({
        incident: z.unknown().nullable(),
    }),
    execute: async ({ context }) => {
        try {
            const { sql, isNeonConfigured } = await import("@/lib/neon/client");
            if (!isNeonConfigured()) {
                return { incident: null };
            }
            const result = await sql`SELECT * FROM incidents WHERE id = ${context.id} LIMIT 1`;
            return { incident: result[0] || null };
        } catch (error) {
            console.error("[Tool] fetchIncident error:", error);
            return { incident: null, error: String(error) };
        }
    },
});

// Create Incident Tool
export const createIncidentTool = createTool({
    id: "createIncident",
    description: "Create a new incident in the database",
    inputSchema: z.object({
        id: z.string(),
        title: z.string(),
        severity: z.number(),
        status: z.string(),
        description: z.string().optional(),
        affectedServices: z.string().optional(),
        createdBy: z.string().optional(),
    }),
    outputSchema: z.object({
        incident: z.unknown().nullable(),
        success: z.boolean(),
    }),
    execute: async ({ context }) => {
        try {
            const { sql, isNeonConfigured } = await import("@/lib/neon/client");
            if (!isNeonConfigured()) {
                return { incident: null, success: false };
            }
            const now = new Date().toISOString();
            const result = await sql`
        INSERT INTO incidents (id, title, severity, status, description, affected_services, created_at, updated_at, created_by)
        VALUES (${context.id}, ${context.title}, ${context.severity}, ${context.status}, ${context.description || ''}, ${context.affectedServices || ''}, ${now}, ${now}, ${context.createdBy || ''})
        RETURNING *
      `;
            return { incident: result[0], success: true };
        } catch (error) {
            console.error("[Tool] createIncident error:", error);
            return { incident: null, success: false, error: String(error) };
        }
    },
});

// Update Incident Tool
export const updateIncidentTool = createTool({
    id: "updateIncident",
    description: "Update an existing incident",
    inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        severity: z.number().optional(),
        status: z.string().optional(),
        description: z.string().optional(),
        affectedServices: z.string().optional(),
        rootCause: z.string().optional(),
    }),
    outputSchema: z.object({
        incident: z.unknown().nullable(),
        success: z.boolean(),
    }),
    execute: async ({ context }) => {
        try {
            const { sql, isNeonConfigured } = await import("@/lib/neon/client");
            if (!isNeonConfigured()) {
                return { incident: null, success: false };
            }
            const now = new Date().toISOString();
            const title = context.title;
            const severity = context.severity;
            const status = context.status;
            const description = context.description;
            const affectedServices = context.affectedServices;
            const rootCause = context.rootCause;

            const result = await sql`
        UPDATE incidents 
        SET title = COALESCE(${title}, title),
            severity = COALESCE(${severity}, severity),
            status = COALESCE(${status}, status),
            description = COALESCE(${description}, description),
            affected_services = COALESCE(${affectedServices}, affected_services),
            root_cause = COALESCE(${rootCause}, root_cause),
            updated_at = ${now}
        WHERE id = ${context.id}
        RETURNING *
      `;
            return { incident: result[0] || null, success: !!result[0] };
        } catch (error) {
            console.error("[Tool] updateIncident error:", error);
            return { incident: null, success: false, error: String(error) };
        }
    },
});

// Create Timeline Event Tool
export const createTimelineEventTool = createTool({
    id: "createTimelineEvent",
    description: "Create a timeline event for an incident",
    inputSchema: z.object({
        id: z.string(),
        incidentId: z.string(),
        actor: z.string(),
        actorType: z.string(),
        eventType: z.string(),
        message: z.string(),
        details: z.string().optional(),
    }),
    outputSchema: z.object({
        event: z.unknown().nullable(),
        success: z.boolean(),
    }),
    execute: async ({ context }) => {
        try {
            const { sql, isNeonConfigured } = await import("@/lib/neon/client");
            if (!isNeonConfigured()) {
                return { event: null, success: false };
            }
            const now = new Date().toISOString();
            const result = await sql`
        INSERT INTO timeline_events (id, incident_id, actor, actor_type, event_type, message, details, timestamp)
        VALUES (${context.id}, ${context.incidentId}, ${context.actor}, ${context.actorType}, ${context.eventType}, ${context.message}, ${context.details || ''}, ${now})
        RETURNING *
      `;
            return { event: result[0], success: true };
        } catch (error) {
            console.error("[Tool] createTimelineEvent error:", error);
            return { event: null, success: false, error: String(error) };
        }
    },
});

// Create Notification Tool
export const createNotificationTool = createTool({
    id: "createNotification",
    description: "Create a notification for a user",
    inputSchema: z.object({
        id: z.string(),
        userId: z.string(),
        type: z.string(),
        message: z.string(),
    }),
    outputSchema: z.object({
        notification: z.unknown().nullable(),
        success: z.boolean(),
    }),
    execute: async ({ context }) => {
        try {
            const { sql, isNeonConfigured } = await import("@/lib/neon/client");
            if (!isNeonConfigured()) {
                return { notification: null, success: false };
            }
            const now = new Date().toISOString();
            const result = await sql`
        INSERT INTO notifications (id, user_id, type, message, read, created_at)
        VALUES (${context.id}, ${context.userId}, ${context.type}, ${context.message}, 0, ${now})
        RETURNING *
      `;
            return { notification: result[0], success: true };
        } catch (error) {
            console.error("[Tool] createNotification error:", error);
            return { notification: null, success: false, error: String(error) };
        }
    },
});

// ============================================
// AGENTS - Using Mastra Agent Class
// ============================================

// Triage Agent - Log Analysis and Root Cause Identification
export const triageAgent = new Agent({
    id: "triage-7",
    name: "Triage-7",
    description: "AI agent specializing in log analysis and root cause identification",
    model: getModel(),
    tools: {
        fetchIncident: fetchIncidentTool,
        fetchIncidents: fetchIncidentsTool,
        createTimelineEvent: createTimelineEventTool,
        createNotification: createNotificationTool,
    },
    instructions: `You are Triage-7, an AI agent specializing in log analysis and root cause identification for incidents.

Your responsibilities:
1. Analyze logs and error messages to identify the root cause of incidents
2. Assess the severity of incidents (1-4 scale)
3. Identify affected services
4. Provide recommendations for remediation

When analyzing:
- Look for patterns in error messages
- Identify common issues like TLS errors, memory issues, connection failures
- Provide confidence scores for your analysis
- Always provide actionable recommendations

Output format:
- Root Cause: Clear statement of what's wrong
- Confidence: 0-100%
- Severity: 1 (critical) to 4 (low)
- Affected Services: List of impacted services
- Recommendations: Array of actionable steps`,
});

// Remedy Agent - Runbook Execution and Remediation
export const remedyAgent = new Agent({
    id: "remedy-3",
    name: "Remedy-3",
    description: "AI agent specializing in runbook execution and remediation",
    model: getModel(),
    tools: {
        fetchIncident: fetchIncidentTool,
        updateIncident: updateIncidentTool,
        createTimelineEvent: createTimelineEventTool,
        createNotification: createNotificationTool,
    },
    instructions: `You are Remedy-3, an AI agent specializing in runbook execution and remediation.

Your responsibilities:
1. Generate step-by-step runbooks based on root cause analysis
2. Execute remediation steps
3. Verify resolution
4. Document the remediation process

When generating runbooks:
- Create 4-6 specific, actionable steps
- Each step should be atomic and verifiable
- Include verification for each step
- Provide clear success criteria

Output format:
- Steps: Array of {step, description, status, output}
- Status: completed, in_progress, failed, or pending
- CompletedAt: ISO timestamp when all steps are done`,
});

// Comms Agent - Stakeholder Communications
export const commsAgent = new Agent({
    id: "comms-1",
    name: "Comms-1",
    description: "AI agent specializing in stakeholder communications",
    model: getModel(),
    tools: {
        fetchIncident: fetchIncidentTool,
        createNotification: createNotificationTool,
    },
    instructions: `You are Comms-1, an AI agent specializing in stakeholder communications during incidents.

Your responsibilities:
1. Generate professional status update emails
2. Create Slack/Teams notifications
3. Update status pages
4. Manage stakeholder expectations

When generating communications:
- Use appropriate severity indicators (SEV-1 to SEV-4)
- Be professional and clear
- Set realistic expectations
- Provide actionable information
- Thank stakeholders for their patience

Output format:
- Status: sent, draft, or failed
- Updates: Array of {channel, message, recipients, status}
- SentAt: ISO timestamp`,
});

// PostMortem Agent - Post-Mortem Generation
export const postMortemAgent = new Agent({
    id: "postmortem-2",
    name: "PostMort-2",
    description: "AI agent specializing in post-mortem documentation",
    model: getModel(),
    tools: {
        fetchIncident: fetchIncidentTool,
        createTimelineEvent: createTimelineEventTool,
    },
    instructions: `You are PostMort-2, an AI agent specializing in post-mortem documentation.

Your responsibilities:
1. Generate comprehensive post-mortem reports
2. Analyze incident timelines
3. Extract lessons learned
4. Create actionable action items

When generating post-mortems:
- Include detailed summary (markdown format)
- List lessons learned (at least 3-5)
- Create action items with priority and owners
- Build comprehensive timeline
- Provide root cause analysis

Output format:
- Summary: Full markdown text
- Timeline: Array of {timestamp, event, actor}
- Root Cause: Detailed explanation
- Resolution: How the issue was resolved
- LessonsLearned: Array of strings
- ActionItems: Array of {description, priority, owner}`,
});

// ============================================
// WORKFLOW - Incident Management Workflow
// ============================================

export const incidentWorkflow = new Workflow({
    id: "incident-management",
    name: "Incident Management Workflow",
    description: "Complete incident lifecycle from detection to resolution",
    triggers: [],
});

// Define workflow steps
incidentWorkflow.step(triageAgent, {
    output: {
        rootCause: z.string(),
        confidence: z.number(),
        severity: z.number(),
        affectedServices: z.array(z.string()),
        recommendations: z.array(z.string()),
    },
});

incidentWorkflow.step(remedyAgent, {
    output: {
        status: z.enum(["completed", "in_progress", "failed", "pending"]),
        steps: z.array(z.object({
            step: z.number(),
            description: z.string(),
            status: z.string(),
            output: z.string().optional(),
        })),
    },
});

incidentWorkflow.step(commsAgent, {
    output: {
        status: z.enum(["sent", "draft", "failed"]),
        updates: z.array(z.object({
            channel: z.string(),
            message: z.string(),
            recipients: z.number(),
            status: z.string(),
        })),
    },
});

incidentWorkflow.step(postMortemAgent, {
    output: {
        summary: z.string(),
        timeline: z.array(z.object({
            timestamp: z.string(),
            event: z.string(),
            actor: z.string(),
        })),
        lessonsLearned: z.array(z.string()),
        actionItems: z.array(z.object({
            description: z.string(),
            priority: z.string(),
            owner: z.string().optional(),
        })),
    },
});

// Define the workflow structure
incidentWorkflow
    .then(triageAgent)
    .then(remedyAgent)
    .then(commsAgent)
    .then(postMortemAgent);

// ============================================
// EXPORTS
// ============================================

export const agents = {
    triage: triageAgent,
    remedy: remedyAgent,
    comms: commsAgent,
    postmortem: postMortemAgent,
};

export const tools = {
    fetchIncidents: fetchIncidentsTool,
    fetchIncident: fetchIncidentTool,
    createIncident: createIncidentTool,
    updateIncident: updateIncidentTool,
    createTimelineEvent: createTimelineEventTool,
    createNotification: createNotificationTool,
};

export const workflows = {
    incidentManagement: incidentWorkflow,
};

export default {
    agents,
    tools,
    workflows,
};
