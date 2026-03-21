/**
 * Shared Workflow State Management
 * Centralized state for workflow execution and human interactions
 */

export interface WorkflowState {
    id: string;
    status: "pending" | "running" | "awaiting_human" | "completed" | "failed";
    currentStep: number;
    stepName: string;
    results: Record<string, any>;
    pausedAt?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: {
        incidentId?: string;
        title?: string;
        severity?: number;
    };
}

// In-memory workflow state storage
const workflowStates = new Map<string, WorkflowState>();

/**
 * Create a new workflow state
 */
export function createWorkflowState(id: string, metadata?: Record<string, any>): WorkflowState {
    const now = new Date().toISOString();
    const state: WorkflowState = {
        id,
        status: "pending",
        currentStep: 0,
        stepName: "initialized",
        results: {},
        createdAt: now,
        updatedAt: now,
        metadata,
    };
    workflowStates.set(id, state);
    return state;
}

/**
 * Get workflow state by ID
 */
export function getWorkflowState(id: string): WorkflowState | undefined {
    return workflowStates.get(id);
}

/**
 * Update workflow state
 */
export function updateWorkflowState(id: string, updates: Partial<WorkflowState>): WorkflowState | undefined {
    const state = workflowStates.get(id);
    if (!state) return undefined;

    const updatedState = {
        ...state,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    workflowStates.set(id, updatedState);
    return updatedState;
}

/**
 * Get all workflow states
 */
export function getAllWorkflowStates(): WorkflowState[] {
    return Array.from(workflowStates.values());
}

/**
 * Delete workflow state
 */
export function deleteWorkflowState(id: string): boolean {
    return workflowStates.delete(id);
}

/**
 * Get workflow states by status
 */
export function getWorkflowsByStatus(status: WorkflowState["status"]): WorkflowState[] {
    return Array.from(workflowStates.values()).filter(s => s.status === status);
}

export default {
    createWorkflowState,
    getWorkflowState,
    updateWorkflowState,
    getAllWorkflowStates,
    deleteWorkflowState,
    getWorkflowsByStatus,
};
