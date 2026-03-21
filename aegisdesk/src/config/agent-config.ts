// Agent configuration constants for Mastra AI
export const AGENT_CONFIG = {
    triage: {
        name: 'Triage Agent',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
    },
    remedy: {
        name: 'Remedy Agent',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 3000,
    },
    postmortem: {
        name: 'Postmortem Agent',
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 4000,
    },
    comms: {
        name: 'Communications Agent',
        model: 'gpt-4',
        temperature: 0.6,
        maxTokens: 2500,
    },
};

export const WORKFLOW_TIMEOUT = 300000; // 5 minutes
export const APPROVAL_TIMEOUT = 600000; // 10 minutes