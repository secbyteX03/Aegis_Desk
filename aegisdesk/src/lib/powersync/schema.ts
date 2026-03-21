/**
 * PowerSync Schema Definition for AegisDesk
 * Defines the client-side database schema with all required tables
 */

import { column, Schema, Table } from "@powersync/web";

// Incidents table - core incident tracking
export const incidents = new Table({
  id: column.text,
  title: column.text,
  severity: column.integer,
  status: column.text,
  description: column.text,
  affected_services: column.text,
  root_cause: column.text,
  organization_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
});

// Timeline events for incident tracking
export const timelineEvents = new Table(
  {
    id: column.text,
    incident_id: column.text,
    organization_id: column.text,
    actor: column.text,
    actor_type: column.text,
    event_type: column.text,
    message: column.text,
    details: column.text,
    timestamp: column.text,
  },
  {
    indexes: {
      incident: ["incident_id"],
    },
  }
);

// Logs table for log ingestion
export const logs = new Table(
  {
    id: column.text,
    incident_id: column.text,
    timestamp: column.text,
    level: column.text,
    service: column.text,
    message: column.text,
    metadata: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      incident: ["incident_id"],
      timestamp: ["timestamp"],
    },
  }
);

// Agents table - AI agent tracking
export const agents = new Table({
  id: column.text,
  name: column.text,
  specialty: column.text,
  status: column.text,
  current_task: column.text,
  progress: column.integer,
  last_heartbeat: column.text,
  capabilities: column.text,
});

// Workflows for runbook execution tracking
export const workflows = new Table(
  {
    id: column.text,
    incident_id: column.text,
    title: column.text,
    description: column.text,
    status: column.text,
    actor: column.text,
    started_at: column.text,
    completed_at: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      incident: ["incident_id"],
    },
  }
);

// Audit log for compliance
export const auditLog = new Table(
  {
    id: column.text,
    incident_id: column.text,
    actor: column.text,
    action: column.text,
    target: column.text,
    details: column.text,
    timestamp: column.text,
  },
  {
    indexes: {
      incident: ["incident_id"],
      timestamp: ["timestamp"],
    },
  }
);

// Runbooks table
export const runbooks = new Table({
  id: column.text,
  title: column.text,
  steps: column.text,
  is_template: column.integer,
  created_at: column.text,
});

// Agent memory for pattern recognition
export const agentMemory = new Table({
  id: column.text,
  agent_id: column.text,
  pattern_type: column.text,
  pattern_data: column.text,
  confidence: column.real,
  created_at: column.text,
});

// Presence for real-time user tracking
export const presence = new Table({
  session_id: column.text,
  user_id: column.text,
  user_name: column.text,
  user_avatar: column.text,
  status: column.text,
  last_seen: column.text,
});

// Sync queue for offline operations
export const syncQueue = new Table({
  id: column.text,
  table_name: column.text,
  record_id: column.text,
  operation: column.text,
  data: column.text,
  created_at: column.text,
  synced_at: column.text,
});

// Notifications table
export const notifications = new Table({
  id: column.text,
  user_id: column.text,
  type: column.text,
  message: column.text,
  read: column.integer,
  created_at: column.text,
  // Team invite specific fields
  invite_token: column.text,
  organization_id: column.text,
  organization_name: column.text,
});

// Knowledge base for AI context
export const knowledgeBase = new Table({
  id: column.text,
  title: column.text,
  content: column.text,
  category: column.text,
  tags: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Team members table
export const teamMembers = new Table({
  id: column.text,
  user_id: column.text,
  organization_id: column.text,
  email: column.text,
  full_name: column.text,
  role: column.text,
  status: column.text,
  invited_by: column.text,
  invited_at: column.text,
  confirmed_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Organizations table
export const organizations = new Table({
  id: column.text,
  name: column.text,
  slug: column.text,
  owner_id: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Team invitations table
export const teamInvitations = new Table({
  id: column.text,
  organization_id: column.text,
  email: column.text,
  role: column.text,
  invited_by: column.text,
  token: column.text,
  status: column.text,
  expires_at: column.text,
  created_at: column.text,
});

// Export the complete schema
export const AegisSchema = new Schema({
  incidents,
  timelineEvents,
  logs,
  agents,
  workflows,
  auditLog,
  runbooks,
  agentMemory,
  presence,
  syncQueue,
  notifications,
  knowledgeBase,
  teamMembers,
  organizations,
  teamInvitations,
});

// Export types for TypeScript support
export type Database = typeof AegisSchema;
export type IncidentRecord = Database["incidents"];
export type TimelineEventRecord = Database["timelineEvents"];
export type LogRecord = Database["logs"];
export type AgentRecord = Database["agents"];
export type WorkflowRecord = Database["workflows"];
export type AuditLogRecord = Database["auditLog"];
export type PresenceRecord = Database["presence"];
export type NotificationRecord = Database["notifications"];
export type SyncQueueRecord = Database["syncQueue"];
