/**
 * Remedy-3 Agent for AegisDesk
 * Runbook Execution Agent
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
    console.log("[Remedy-3] Using OpenAI model");
    return openaiModel;
  }
  console.log("[Remedy-3] Using Gemini model");
  return geminiModel;
}

// Input schemas
const remedyInputSchema = z.object({
  incidentId: z.string(),
  rootCause: z.string(),
  recommendations: z.array(z.string()).optional(),
});

type RemedyInput = z.infer<typeof remedyInputSchema>;

// Output schemas
const remedyOutputSchema = z.object({
  incidentId: z.string(),
  status: z.enum(["completed", "in_progress", "failed", "pending"]),
  steps: z.array(z.object({
    step: z.number(),
    description: z.string(),
    status: z.enum(["completed", "in_progress", "failed", "pending"]),
    output: z.string().optional(),
  })),
  completedAt: z.string().optional(),
});

type RemedyOutput = z.infer<typeof remedyOutputSchema>;

/**
 * Generate runbook steps based on root cause using AI
 */
async function generateRunbookWithAI(rootCause: string): Promise<Array<{ description: string, status: string }>> {
  console.log(`[Remedy-3] Generating AI-powered runbook for: ${rootCause}`);

  const prompt = `Generate a step-by-step runbook to fix the following issue:

Root Cause: ${rootCause}

Provide 4-6 specific steps to remediate this issue. Each step should be:
- Clear and actionable
- Atomic (one action per step)
- Include verification

Format your response as a numbered list with brief descriptions.`;

  try {
    const result = await generateText({
      model: getModel(),
      prompt: prompt,
    });
    const text = result.text;

    // Parse the AI response to extract steps
    const steps: Array<{ description: string, status: string }> = [];
    const stepMatches = text.matchAll(/(\d+)[\.\)]\s*(.{10,150})/g);

    for (const match of stepMatches) {
      steps.push({
        description: match[2].trim(),
        status: "pending"
      });
    }

    // If AI didn't return structured data, use default
    if (steps.length === 0) {
      return generateDefaultRunbook(rootCause);
    }

    return steps;
  } catch (error) {
    console.error("[Remedy-3] AI runbook generation failed, using default:", error);
    return generateDefaultRunbook(rootCause);
  }
}

/**
 * Generate default runbook based on root cause (fallback)
 */
function generateDefaultRunbook(rootCause: string): Array<{ description: string, status: string }> {
  const runbooks: Record<string, Array<{ description: string, status: string }>> = {
    "TLS certificate": [
      { description: "Renew TLS certificate", status: "pending" },
      { description: "Update certificate in secret manager", status: "pending" },
      { description: "Restart affected services", status: "pending" },
      { description: "Verify certificate is valid", status: "pending" },
    ],
    "Memory exhaustion": [
      { description: "Scale up pods to increase memory", status: "pending" },
      { description: "Check for memory leaks", status: "pending" },
      { description: "Restart affected containers", status: "pending" },
      { description: "Monitor memory usage", status: "pending" },
    ],
    "Connection failure": [
      { description: "Check service connectivity", status: "pending" },
      { description: "Verify network policies", status: "pending" },
      { description: "Restart connection pools", status: "pending" },
      { description: "Test endpoint accessibility", status: "pending" },
    ],
    "Database query": [
      { description: "Identify slow queries", status: "pending" },
      { description: "Add database indexes", status: "pending" },
      { description: "Clear connection pool", status: "pending" },
      { description: "Verify query performance", status: "pending" },
    ],
    "Container terminated": [
      { description: "Check pod logs", status: "pending" },
      { description: "Review resource limits", status: "pending" },
      { description: "Restart container", status: "pending" },
      { description: "Verify health checks", status: "pending" },
    ],
  };

  // Find matching runbook
  for (const [key, steps] of Object.entries(runbooks)) {
    if (rootCause.toLowerCase().includes(key.toLowerCase())) {
      return steps;
    }
  }

  // Default runbook
  return [
    { description: "Investigate root cause", status: "pending" },
    { description: "Apply fix", status: "pending" },
    { description: "Verify resolution", status: "pending" },
    { description: "Document findings", status: "pending" },
  ];
}

/**
 * Execute runbook steps
 */
async function executeRunbook(input: RemedyInput): Promise<RemedyOutput> {
  console.log(`[Remedy-3] Executing runbook for incident ${input.incidentId}`);

  // Generate runbook (AI or default)
  const steps = await generateRunbookWithAI(input.rootCause);

  // Simulate step execution
  const executedSteps = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`[Remedy-3] Executing step ${i + 1}: ${step.description}`);

    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 300));

    executedSteps.push({
      step: i + 1,
      description: step.description,
      status: "completed" as const,
      output: `Step ${i + 1} completed successfully`,
    });
  }

  const completedAt = new Date().toISOString();

  return {
    incidentId: input.incidentId,
    status: "completed",
    steps: executedSteps,
    completedAt,
  };
}

/**
 * Run full remedy process
 */
export async function runRemedy(input: RemedyInput): Promise<RemedyOutput> {
  console.log(`[Remedy-3] Running remedy for ${input.incidentId}`);

  const remedyResult = await executeRunbook(input);

  console.log(`[Remedy-3] Remedy complete. Status: ${remedyResult.status}`);

  return remedyResult;
}

// Agent configuration
export const remedy3Config = {
  name: "Remedy-3",
  description: "AI agent specializing in runbook execution and remediation",
  specialty: "remedy",
  provider: "GOOGLE",
  model: "gemini-2.0-flash",
  capabilities: [
    "Runbook execution",
    "Remediation automation",
    "Step-by-step guidance",
    "Fix verification",
  ],
};

export { remedyInputSchema, remedyOutputSchema };
export default { runRemedy, config: remedy3Config };
