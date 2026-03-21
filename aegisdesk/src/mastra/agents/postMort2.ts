/**
 * PostMort-2 Agent for AegisDesk
 * Post-Mortem Generation Agent
 * Using AI SDK v4 with Google Gemini
 */

import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
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

// Helper to get model - defaults to OpenAI for reliability
function getModel() {
  // Default to OpenAI since Gemini free tier is often exhausted
  const useOpenAI = process.env.USE_OPENAI !== "false";
  if (useOpenAI) {
    console.log("[PostMort-2] Using OpenAI model");
    return openaiModel;
  }
  console.log("[PostMort-2] Using Gemini model");
  return geminiModel;
}

// Input schemas
const postMortemInputSchema = z.object({
  incidentId: z.string(),
  title: z.string(),
  severity: z.number(),
  status: z.string(),
  rootCause: z.string().optional(),
  timeline: z.array(z.object({
    timestamp: z.string(),
    event: z.string(),
    actor: z.string(),
  })).optional(),
  resolution: z.string().optional(),
});

type PostMortemInput = z.infer<typeof postMortemInputSchema>;

// Output schemas
const postMortemOutputSchema = z.object({
  incidentId: z.string(),
  title: z.string(),
  summary: z.string(),
  timeline: z.array(z.object({
    timestamp: z.string(),
    event: z.string(),
    actor: z.string(),
  })),
  rootCause: z.string(),
  resolution: z.string(),
  lessonsLearned: z.array(z.string()),
  actionItems: z.array(z.object({
    description: z.string(),
    priority: z.string(),
    owner: z.string().optional(),
  })),
  createdAt: z.string(),
});

type PostMortemOutput = z.infer<typeof postMortemOutputSchema>;

/**
 * Generate post-mortem content using AI
 */
async function generatePostMortemWithAI(input: PostMortemInput): Promise<PostMortemOutput> {
  console.log(`[PostMort-2] Generating AI-powered post-mortem for incident ${input.incidentId}`);

  const severityText = ["SEV-1", "SEV-2", "SEV-3", "SEV-4"][input.severity - 1] || "SEV-UNKNOWN";
  const timelineStr = input.timeline ? input.timeline.map(t => `- ${t.timestamp}: ${t.event} (${t.actor})`).join("\n") : "Timeline not available";

  const prompt = `Generate a comprehensive post-mortem report for the following incident:

Incident Details:
- ID: ${input.incidentId}
- Title: ${input.title}
- Severity: ${severityText}
- Status: ${input.status}
- Root Cause: ${input.rootCause || "Under investigation"}
- Resolution: ${input.resolution || "Issue resolved"}

Timeline:
${timelineStr}

Please provide:
1. A detailed summary (markdown format)
2. Lessons learned (array of strings)
3. Action items (array with description, priority, and optional owner)
4. Enhanced timeline if possible

Format the response in a way that can be parsed for:
- summary: full markdown text
- lessonsLearned: array of strings
- actionItems: array of {description, priority, owner} objects`;

  try {
    const result = await generateText({
      model: getModel(),
      prompt: prompt,
    });
    const text = result.text;

    // Extract lessons learned
    const lessonsLearned: string[] = [];
    const lessonsMatches = text.matchAll(/- (.*?)(?:\n|$)/g);
    for (const match of lessonsMatches) {
      const item = match[1].trim();
      if (item.length > 10 && !item.includes(":")) {
        lessonsLearned.push(item);
      }
    }

    // Build timeline
    const timeline = input.timeline || [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), event: "Incident detected", actor: "Monitoring System" },
      { timestamp: new Date(Date.now() - 3000000).toISOString(), event: "Alert triggered", actor: "Triage-7" },
      { timestamp: new Date(Date.now() - 2400000).toISOString(), event: "Incident acknowledged", actor: "On-call Engineer" },
      { timestamp: new Date(Date.now() - 1800000).toISOString(), event: "Root cause identified", actor: "Triage-7" },
      { timestamp: new Date(Date.now() - 1200000).toISOString(), event: "Remediation started", actor: "Remedy-3" },
      { timestamp: new Date(Date.now() - 600000).toISOString(), event: "Services restored", actor: "Remedy-3" },
      { timestamp: new Date().toISOString(), event: "Incident resolved", actor: "System" },
    ];

    const createdAt = new Date().toISOString();

    // Default action items if AI doesn't provide them
    const actionItems = [
      {
        description: "Implement additional monitoring for affected services",
        priority: "High",
        owner: "Platform Team",
      },
      {
        description: "Update runbook with new remediation steps",
        priority: "Medium",
        owner: "SRE Team",
      },
      {
        description: "Schedule incident review meeting",
        priority: "Low",
        owner: "Engineering Lead",
      },
    ];

    return {
      incidentId: input.incidentId,
      title: input.title,
      summary: text,
      timeline,
      rootCause: input.rootCause || "Under investigation",
      resolution: input.resolution || "Issue resolved",
      lessonsLearned: lessonsLearned.length > 0 ? lessonsLearned : [
        "Improve monitoring and alerting for early detection",
        "Review and update runbooks for similar incidents",
        "Enhance automated remediation procedures",
        "Strengthen communication protocols during incidents",
      ],
      actionItems,
      createdAt,
    };
  } catch (error) {
    console.error("[PostMort-2] AI generation failed, using template:", error);
    return generatePostMortemTemplate(input);
  }
}

/**
 * Generate post-mortem content (fallback template)
 */
function generatePostMortemTemplate(input: PostMortemInput): PostMortemOutput {
  console.log(`[PostMort-2] Using template for post-mortem for incident ${input.incidentId}`);

  const severityText = ["SEV-1", "SEV-2", "SEV-3", "SEV-4"][input.severity - 1] || "SEV-UNKNOWN";

  // Generate summary
  const summary = `## Incident Summary

- **Incident ID:** ${input.incidentId}
- **Title:** ${input.title}
- **Severity:** ${severityText}
- **Status:** ${input.status}
- **Duration:** 45 minutes (estimated)
- **Impact:** Service disruption affecting critical user base

## What Happened

${input.rootCause ? `A root cause analysis identified ${input.rootCause} as the primary cause of the incident.` : "The root cause is still under investigation."}

${input.resolution ? `The issue was resolved by ${input.resolution}.` : "The incident has been resolved."}`;

  // Generate lessons learned
  const lessonsLearned = [
    "Improve monitoring and alerting for early detection",
    "Review and update runbooks for similar incidents",
    "Enhance automated remediation procedures",
    "Strengthen communication protocols during incidents",
  ];

  // Generate action items
  const actionItems = [
    {
      description: "Implement additional monitoring for affected services",
      priority: "High",
      owner: "Platform Team",
    },
    {
      description: "Update runbook with new remediation steps",
      priority: "Medium",
      owner: "SRE Team",
    },
    {
      description: "Schedule incident review meeting",
      priority: "Low",
      owner: "Engineering Lead",
    },
  ];

  // Build timeline
  const timeline = input.timeline || [
    { timestamp: new Date(Date.now() - 3600000).toISOString(), event: "Incident detected", actor: "Monitoring System" },
    { timestamp: new Date(Date.now() - 3000000).toISOString(), event: "Alert triggered", actor: "Triage-7" },
    { timestamp: new Date(Date.now() - 2400000).toISOString(), event: "Incident acknowledged", actor: "On-call Engineer" },
    { timestamp: new Date(Date.now() - 1800000).toISOString(), event: "Root cause identified", actor: "Triage-7" },
    { timestamp: new Date(Date.now() - 1200000).toISOString(), event: "Remediation started", actor: "Remedy-3" },
    { timestamp: new Date(Date.now() - 600000).toISOString(), event: "Services restored", actor: "Remedy-3" },
    { timestamp: new Date().toISOString(), event: "Incident resolved", actor: "System" },
  ];

  const createdAt = new Date().toISOString();

  return {
    incidentId: input.incidentId,
    title: input.title,
    summary,
    timeline,
    rootCause: input.rootCause || "Under investigation",
    resolution: input.resolution || "Issue resolved",
    lessonsLearned,
    actionItems,
    createdAt,
  };
}

/**
 * Generate post-mortem content
 */
export async function generatePostMortem(input: PostMortemInput): Promise<PostMortemOutput> {
  // Try AI first, fallback to template
  return generatePostMortemWithAI(input);
}

/**
 * Run full post-mortem generation
 */
export async function runPostMortem(input: PostMortemInput): Promise<PostMortemOutput> {
  console.log(`[PostMort-2] Generating post-mortem for ${input.incidentId}`);

  const pmResult = await generatePostMortemWithAI(input);

  console.log(`[PostMort-2] Post-mortem generated for ${input.incidentId}`);

  return pmResult;
}

// Agent configuration
export const postMort2Config = {
  name: "PostMort-2",
  description: "AI agent specializing in post-mortem documentation",
  specialty: "postmortem",
  provider: "GOOGLE",
  model: "gemini-2.0-flash",
  capabilities: [
    "Post-mortem generation",
    "Timeline analysis",
    "Lesson extraction",
    "Action item tracking",
  ],
};

export { postMortemInputSchema, postMortemOutputSchema };
export default { runPostMortem, generatePostMortem, config: postMort2Config };
