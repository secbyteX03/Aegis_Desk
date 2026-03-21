// API response types for agentic workflows
export interface AgentResponse {
    success: boolean;
    agent: string;
    result?: string;
    error?: string;
    executionTime: number;
}

export interface WorkflowResponse {
    workflowId: string;
    status: string;
    currentAgent: string;
    result?: string;
    requiresApproval: boolean;
}

export interface SyncStatus {
    connected: boolean;
    lastSync: Date | null;
    pendingChanges: number;
    offline: boolean;
}