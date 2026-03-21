// Database type definitions for PowerSync and Neon
export interface User {
    id: string;
    email: string;
    name: string;
    teamId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Team {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Incident {
    id: string;
    title: string;
    description: string;
    status: 'open' | 'investigating' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    assigneeId?: string;
    teamId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Activity {
    id: string;
    incidentId: string;
    userId: string;
    action: string;
    details: string;
    createdAt: Date;
}

export interface Workflow {
    id: string;
    incidentId: string;
    status: 'pending' | 'in_progress' | 'awaiting_approval' | 'completed' | 'failed';
    currentAgent: string;
    result?: string;
    createdAt: Date;
    updatedAt: Date;
}