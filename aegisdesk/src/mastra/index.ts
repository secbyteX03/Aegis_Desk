/**
 * Mastra Agents Index for AegisDesk
 * Central export point for all AI agents
 * 
 * This file exports:
 * - Legacy agents (for backward compatibility)
 * - New Mastra agents
 * - Tools
 * - Workflows
 * - Utility functions
 */

// Re-export new Mastra components
export * from "./mastra";
export * from "./workflow-state";

// Legacy imports (for backward compatibility)
import { runTriage, triage7Config } from "./agents/triage7";
import { runRemedy, remedy3Config } from "./agents/remedy3";
import { runComms, comms1Config } from "./agents/comms1";
import { runPostMortem, postMort2Config } from "./agents/postMort2";

// Legacy agent exports
export const agents = {
  triage: {
    name: triage7Config.name,
    description: triage7Config.description,
    specialty: triage7Config.specialty,
    provider: triage7Config.provider,
    model: triage7Config.model,
    run: runTriage,
    config: triage7Config,
  },
  remedy: {
    name: remedy3Config.name,
    description: remedy3Config.description,
    specialty: remedy3Config.specialty,
    provider: remedy3Config.provider,
    model: remedy3Config.model,
    run: runRemedy,
    config: remedy3Config,
  },
  comms: {
    name: comms1Config.name,
    description: comms1Config.description,
    specialty: comms1Config.specialty,
    provider: comms1Config.provider,
    model: comms1Config.model,
    run: runComms,
    config: comms1Config,
  },
  postmortem: {
    name: postMort2Config.name,
    description: postMort2Config.description,
    specialty: postMort2Config.specialty,
    provider: postMort2Config.provider,
    model: postMort2Config.model,
    run: runPostMortem,
    config: postMort2Config,
  },
};

// Agent configurations
export const agentConfigs = {
  triage: triage7Config,
  remedy: remedy3Config,
  comms: comms1Config,
  postmortem: postMort2Config,
};

// Run a specific agent by type (legacy function)
export async function runAgent(
  agentType: "triage" | "remedy" | "comms" | "postmortem",
  input: unknown
): Promise<unknown> {
  const agent = agents[agentType];

  if (!agent) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  console.log(`[Mastra] Running agent: ${agent.name} (Provider: ${agent.provider}, Model: ${agent.model})`);

  return agent.run(input);
}

// Get agent info
export function getAgentInfo(agentType: string) {
  return agentConfigs[agentType as keyof typeof agentConfigs];
}

export default {
  agents,
  agentConfigs,
  runAgent,
  getAgentInfo,
};
