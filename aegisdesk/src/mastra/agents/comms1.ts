/**
 * Comms-1 Agent for AegisDesk
 * Stakeholder Communications Agent
 * Using AI SDK v4 with Google Gemini
 */

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";

// Initialize Google Gemini using AI SDK v4's model wrapper
// This ensures compatibility with AI SDK 4's specification version "v1"
const model = google("gemini-2.0-flash", {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Input schemas
const commsInputSchema = z.object({
  incidentId: z.string(),
  title: z.string(),
  severity: z.number(),
  status: z.string(),
  rootCause: z.string().optional(),
  affectedServices: z.array(z.string()).optional(),
  recipients: z.array(z.string()).optional(),
});

type CommsInput = z.infer<typeof commsInputSchema>;

// Output schemas
const commsOutputSchema = z.object({
  incidentId: z.string(),
  status: z.enum(["sent", "draft", "failed"]),
  updates: z.array(z.object({
    channel: z.string(),
    message: z.string(),
    recipients: z.number(),
    status: z.string(),
  })),
  sentAt: z.string().optional(),
});

type CommsOutput = z.infer<typeof commsOutputSchema>;

/**
 * Generate status update message using AI
 */
async function generateStatusUpdateWithAI(input: CommsInput): Promise<string> {
  console.log(`[Comms-1] Generating AI-powered status update for incident ${input.incidentId}`);

  const severityText = ["SEV-1", "SEV-2", "SEV-3", "SEV-4"][input.severity - 1] || "SEV-UNKNOWN";

  const prompt = `Generate a formal incident status update email for stakeholders.

Incident Details:
- Title: ${input.title}
- Status: ${input.status}
- Severity: ${severityText}
${input.affectedServices ? `- Affected Services: ${input.affectedServices.join(", ")}` : ""}
${input.rootCause ? `- Root Cause: ${input.rootCause}` : ""}

The email should:
1. Be professional and clear
2. Explain the current status
3. Set expectations for resolution
4. Thank stakeholders for their patience
5. Provide a way to get more information

Format as a proper email with subject line and body.`;

  try {
    const result = await generateText({
      model: model,
      prompt: prompt,
    });
    return result.text;
  } catch (error) {
    console.error("[Comms-1] AI generation failed, using template:", error);
    return generateStatusUpdateTemplate(input);
  }
}

/**
 * Generate status update (fallback template)
 */
function generateStatusUpdateTemplate(input: CommsInput): string {
  const severityText = ["SEV-1", "SEV-2", "SEV-3", "SEV-4"][input.severity - 1] || "SEV-UNKNOWN";

  let message = `# Incident Update: ${input.title}\n\n`;
  message += `**Status:** ${input.status}\n`;
  message += `**Severity:** ${severityText}\n`;

  if (input.affectedServices && input.affectedServices.length > 0) {
    message += `**Affected Services:** ${input.affectedServices.join(", ")}\n`;
  }

  if (input.rootCause) {
    message += `**Root Cause:** ${input.rootCause}\n`;
  }

  message += `\nWe're working on resolving this as quickly as possible. `;
  message += `We'll provide updates every 30 minutes.`;

  return message;
}

/**
 * Generate Slack message using AI
 */
async function generateSlackMessageWithAI(input: CommsInput): Promise<string> {
  console.log(`[Comms-1] Generating AI-powered Slack message for incident ${input.incidentId}`);

  const prompt = `Generate a brief, impactful Slack message for an incident notification.

Incident Details:
- Title: ${input.title}
- Status: ${input.status}
- Severity: SEV-${input.severity}
${input.affectedServices ? `- Affected: ${input.affectedServices.join(", ")}` : ""}
${input.rootCause ? `- Root Cause: ${input.rootCause}` : ""}

Requirements:
1. Start with appropriate emoji (🔴 for SEV-1, 🟠 for SEV-2, 🟡 for SEV-3, 🟢 for SEV-4)
2. Use bold for important information
3. Keep it under 200 characters if possible
4. Include what action to take if any
5. End with a brief reassuring note

Use Slack markdown formatting (*bold*, _italic_, etc.)`;

  try {
    const result = await generateText({
      model: model,
      prompt: prompt,
    });
    return result.text;
  } catch (error) {
    console.error("[Comms-1] AI Slack generation failed, using template:", error);
    return generateSlackMessageTemplate(input);
  }
}

/**
 * Generate Slack message (fallback template)
 */
function generateSlackMessageTemplate(input: CommsInput): string {
  const severityEmoji = ["🔴", "🟠", "🟡", "🟢"][input.severity - 1] || "⚪";
  const statusEmoji = input.status === "Resolved" ? "✅" : "⚠️";

  let message = `${severityEmoji} *Incident ${input.status}*: ${input.title}\n`;
  message += `_Severity: SEV-${input.severity} ${statusEmoji}_\n\n`;

  if (input.rootCause) {
    message += `*Root Cause:* ${input.rootCause}\n`;
  }

  if (input.affectedServices && input.affectedServices.length > 0) {
    message += `*Affected:* ${input.affectedServices.join(", ")}\n`;
  }

  message += `\n_Updates to follow. Engineering is actively working on resolution._`;

  return message;
}

/**
 * Execute communications
 */
async function executeComms(input: CommsInput): Promise<CommsOutput> {
  console.log(`[Comms-1] Executing communications for incident ${input.incidentId}`);

  const updates = [];

  // Generate email update with AI
  const emailMessage = await generateStatusUpdateWithAI(input);
  updates.push({
    channel: "email",
    message: emailMessage,
    recipients: input.recipients?.length || 12,
    status: "sent",
  });

  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 200));

  // Generate Slack update with AI
  const slackMessage = await generateSlackMessageWithAI(input);
  updates.push({
    channel: "slack",
    message: slackMessage,
    recipients: input.recipients?.length || 5,
    status: "sent",
  });

  // Simulate Slack sending
  await new Promise(resolve => setTimeout(resolve, 200));

  const sentAt = new Date().toISOString();

  return {
    incidentId: input.incidentId,
    status: "sent",
    updates,
    sentAt,
  };
}

/**
 * Run full communications process
 */
export async function runComms(input: CommsInput): Promise<CommsOutput> {
  console.log(`[Comms-1] Running communications for ${input.incidentId}`);

  const commsResult = await executeComms(input);

  console.log(`[Comms-1] Communications complete. Status: ${commsResult.status}`);

  return commsResult;
}

// Agent configuration
export const comms1Config = {
  name: "Comms-1",
  description: "AI agent specializing in stakeholder communications",
  specialty: "communications",
  provider: "GOOGLE",
  model: "gemini-2.0-flash",
  capabilities: [
    "Status page updates",
    "Email notifications",
    "Slack notifications",
    "Stakeholder management",
  ],
};

export { commsInputSchema, commsOutputSchema };
export default { runComms, config: comms1Config };
