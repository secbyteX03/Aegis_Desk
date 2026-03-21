/**
 * Triage-7 Agent for AegisDesk
 * Log Analysis and Root Cause Identification Agent
 * Using AI SDK v4 with Google Gemini
 */

import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { getProvider } from "@/lib/provider-cache";

// Initialize Google Gemini using AI SDK v4's model wrapper
// This ensures compatibility with AI SDK 4's specification version "v1"
const geminiModel = google("gemini-2.0-flash", {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Initialize OpenAI model as fallback
const openaiModel = openai("gpt-4o-mini", {
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to get model - uses provider cache set by UI switcher
function getModel() {
  const provider = getProvider();
  if (provider === 'openai') {
    console.log("[Triage-7] Using OpenAI model");
    return openaiModel;
  }
  console.log("[Triage-7] Using Gemini model");
  return geminiModel;
}

// Input schemas
const triageInputSchema = z.object({
  incidentId: z.string(),
  logs: z.string().optional(),
  errorMessages: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
});

type TriageInput = z.infer<typeof triageInputSchema>;

// Output schemas
const triageOutputSchema = z.object({
  incidentId: z.string(),
  rootCause: z.string(),
  confidence: z.number().min(0).max(100),
  analysis: z.string(),
  affectedServices: z.array(z.string()),
  recommendations: z.array(z.string()),
  severity: z.number().min(1).max(4),
});

type TriageOutput = z.infer<typeof triageOutputSchema>;

/**
 * Analyze logs using Gemini AI
 */
async function analyzeLogsWithGemini(input: TriageInput): Promise<TriageOutput> {
  console.log(`[Triage-7] Analyzing incident ${input.incidentId} with Gemini`);

  const prompt = `Analyze the following incident data and provide root cause analysis:

Incident ID: ${input.incidentId}
${input.services ? `Affected Services: ${input.services.join(", ")}` : ""}
${input.errorMessages ? `Error Messages: ${input.errorMessages.join("\n")}` : ""}
${input.logs ? `Logs:\n${input.logs}` : ""}

Please provide:
1. Root Cause (clear statement)
2. Confidence Score (0-100%)
3. Severity (1-4, where 1 is critical)
4. Affected Services (list)
5. Recommendations (array of strings)
6. Full Analysis (detailed explanation)`;

  try {
    const result = await generateText({
      model: getModel(),
      prompt: prompt,
    });
    const text = result.text;

    // Parse the AI response
    const rootCauseMatch = text.match(/root cause[:\s]+(.{10,200})/i) || text.match(/原因[:\s]+(.{10,200})/i);
    const confidenceMatch = text.match(/confidence[:\s]+(\d+)%/i) || text.match(/置信度[:\s]+(\d+)%/i);
    const severityMatch = text.match(/severity[:\s]+(\d+)/i) || text.match(/严重程度[:\s]+(\d+)/i);

    const rootCause = rootCauseMatch ? rootCauseMatch[1].trim() : "Analysis in progress";
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;
    const severity = severityMatch ? parseInt(severityMatch[1]) : 2;

    // Extract recommendations
    const recommendations: string[] = [];
    const recMatches = text.matchAll(/- (.*?)(?:\n|$)/g);
    for (const match of recMatches) {
      recommendations.push(match[1].trim());
    }

    return {
      incidentId: input.incidentId,
      rootCause,
      confidence,
      analysis: text,
      affectedServices: input.services || [],
      recommendations: recommendations.length > 0 ? recommendations : ["Review logs manually", "Check service health"],
      severity: Math.min(4, Math.max(1, severity)),
    };
  } catch (error) {
    console.error("[Triage-7] AI Analysis failed, using fallback:", error);
    return analyzeLogsFallback(input);
  }
}

/**
 * Fallback pattern matching if AI fails
 */
function analyzeLogsFallback(input: TriageInput): TriageOutput {
  console.log(`[Triage-7] Using fallback analysis for incident ${input.incidentId}`);

  const logLines = input.logs?.split("\n") || [];

  let rootCause = "Unknown";
  let confidence = 50;
  let severity = 2;
  const affectedServices: string[] = input.services || [];
  const recommendations: string[] = [];

  const patterns = [
    { pattern: /TLS|certificate|ssl|expired/i, cause: "TLS certificate expired or invalid", severity: 1 },
    { pattern: /memory|heap|out of memory|OOM/i, cause: "Memory exhaustion", severity: 1 },
    { pattern: /connection|timeout|ECONNREFUSED/i, cause: "Connection failure", severity: 2 },
    { pattern: /database|sql|query/i, cause: "Database query failure", severity: 2 },
    { pattern: /pod|container|restart|killed/i, cause: "Container terminated", severity: 1 },
    { pattern: /disk|space|no space/i, cause: "Disk space exhausted", severity: 1 },
  ];

  for (const line of logLines) {
    for (const p of patterns) {
      if (p.pattern.test(line)) {
        rootCause = p.cause;
        confidence = Math.min(95, confidence + 20);
        severity = Math.min(severity, p.severity);
        break;
      }
    }
  }

  if (rootCause.includes("TLS")) {
    recommendations.push("Renew TLS certificate");
    recommendations.push("Check certificate expiration monitoring");
  }
  if (rootCause.includes("memory")) {
    recommendations.push("Increase memory limits");
    recommendations.push("Review memory leaks in application");
  }
  if (rootCause.includes("connection")) {
    recommendations.push("Check service connectivity");
    recommendations.push("Review network policies");
  }

  const analysis = `
Analyzed ${logLines.length} log lines for incident ${input.incidentId}.

Key findings:
- Root cause identified: ${rootCause}
- Confidence: ${confidence}%
- Severity assessment: SEV-${severity}

${recommendations.length > 0 ? "Recommended actions:\n" + recommendations.map(r => `- ${r}`).join("\n") : ""}
  `.trim();

  return {
    incidentId: input.incidentId,
    rootCause,
    confidence,
    analysis,
    affectedServices,
    recommendations,
    severity,
  };
}

/**
 * Run full triage analysis
 */
export async function runTriage(input: TriageInput): Promise<TriageOutput> {
  console.log(`[Triage-7] Running full triage for ${input.incidentId}`);

  // Try AI analysis first, fallback to pattern matching
  const triageResult = await analyzeLogsWithGemini(input);

  console.log(`[Triage-7] Triage complete. Root cause: ${triageResult.rootCause} (${triageResult.confidence}% confidence)`);

  return triageResult;
}

// Agent configuration
export const triage7Config = {
  name: "Triage-7",
  description: "AI agent specializing in log analysis and root cause identification",
  specialty: "triage",
  provider: "GOOGLE",
  model: "gemini-2.0-flash",
  capabilities: [
    "Log analysis",
    "Pattern recognition",
    "Root cause identification",
    "Severity assessment",
  ],
};

export { triageInputSchema, triageOutputSchema };
export default { runTriage, config: triage7Config };
