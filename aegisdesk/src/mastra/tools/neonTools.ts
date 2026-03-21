/**
 * Neon Database Tools for AegisDesk
 * Provides tools for interacting with Neon database
 */

import { z } from "zod";
import { sql, isNeonConfigured } from "../../lib/neon/client";

// Query result schema
export const queryResultSchema = z.object({
  rows: z.array(z.record(z.unknown())),
  rowCount: z.number().optional(),
});

export type QueryResult = z.infer<typeof queryResultSchema>;

/**
 * Execute a SQL query on Neon database
 * Note: For security, use parameterized queries. This is a simple example.
 * In production, use proper parameterized queries to prevent SQL injection.
 */
export async function executeQuery(sqlQuery: string): Promise<QueryResult> {
  console.log("[Neon] executeQuery is disabled for security. Use parameterized queries instead.");
  return { rows: [], rowCount: 0 };
}

/**
 * Fetch incidents from database
 */
export async function fetchIncidents(limit: number = 50): Promise<unknown[]> {
  if (!isNeonConfigured()) return [];

  const result = await sql<Record<string, unknown>>`
    SELECT * FROM incidents ORDER BY created_at DESC LIMIT ${limit}
  `;
  return result;
}

/**
 * Fetch a single incident by ID
 */
export async function fetchIncident(id: string): Promise<unknown | null> {
  if (!isNeonConfigured()) return null;

  const result = await sql<Record<string, unknown>>`
    SELECT * FROM incidents WHERE id = ${id} LIMIT 1
  `;
  return result[0] || null;
}

/**
 * Create a new incident
 */
export async function createIncident(incident: {
  id: string;
  title: string;
  severity: number;
  status: string;
  description?: string;
  affected_services?: string;
  created_by?: string;
}): Promise<unknown> {
  if (!isNeonConfigured()) return null;

  const now = new Date().toISOString();

  const result = await sql<Record<string, unknown>>`
    INSERT INTO incidents (id, title, severity, status, description, affected_services, created_at, updated_at, created_by)
    VALUES (${incident.id}, ${incident.title}, ${incident.severity}, ${incident.status}, ${incident.description || ''}, ${incident.affected_services || ''}, ${now}, ${now}, ${incident.created_by || ''})
    RETURNING *
  `;

  return result[0];
}

/**
 * Update an incident
 */
export async function updateIncident(
  id: string,
  updates: Record<string, unknown>
): Promise<unknown | null> {
  if (!isNeonConfigured()) return null;

  const now = new Date().toISOString();

  // Build update query dynamically
  const title = updates.title as string | undefined;
  const severity = updates.severity as number | undefined;
  const status = updates.status as string | undefined;
  const description = updates.description as string | undefined;
  const affectedServices = updates.affected_services as string | undefined;
  const rootCause = updates.root_cause as string | undefined;

  const result = await sql<Record<string, unknown>>`
    UPDATE incidents 
    SET title = COALESCE(${title}, title),
        severity = COALESCE(${severity}, severity),
        status = COALESCE(${status}, status),
        description = COALESCE(${description}, description),
        affected_services = COALESCE(${affectedServices}, affected_services),
        root_cause = COALESCE(${rootCause}, root_cause),
        updated_at = ${now}
    WHERE id = ${id}
    RETURNING *
  `;

  return result[0] || null;
}

/**
 * Fetch timeline events for an incident
 */
export async function fetchTimelineEvents(incidentId: string): Promise<unknown[]> {
  if (!isNeonConfigured()) return [];

  const result = await sql<Record<string, unknown>>`
    SELECT * FROM timeline_events WHERE incident_id = ${incidentId} ORDER BY timestamp DESC
  `;
  return result;
}

/**
 * Create a timeline event
 */
export async function createTimelineEvent(event: {
  id: string;
  incident_id: string;
  actor: string;
  actor_type: string;
  event_type: string;
  message: string;
  details?: string;
}): Promise<unknown> {
  if (!isNeonConfigured()) return null;

  const now = new Date().toISOString();

  const result = await sql<Record<string, unknown>>`
    INSERT INTO timeline_events (id, incident_id, actor, actor_type, event_type, message, details, timestamp)
    VALUES (${event.id}, ${event.incident_id}, ${event.actor}, ${event.actor_type}, ${event.event_type}, ${event.message}, ${event.details || ''}, ${now})
    RETURNING *
  `;

  return result[0];
}

/**
 * Fetch agents
 */
export async function fetchAgents(): Promise<unknown[]> {
  if (!isNeonConfigured()) return [];

  const result = await sql<Record<string, unknown>>`SELECT * FROM agents ORDER BY name`;
  return result;
}

/**
 * Update agent status
 */
export async function updateAgentStatus(
  id: string,
  status: string,
  currentTask?: string
): Promise<unknown | null> {
  if (!isNeonConfigured()) return null;

  const now = new Date().toISOString();

  const result = await sql<Record<string, unknown>>`
    UPDATE agents 
    SET status = ${status}, current_task = ${currentTask || ''}, last_heartbeat = ${now}
    WHERE id = ${id}
    RETURNING *
  `;

  return result[0] || null;
}

/**
 * Create notification
 */
export async function createNotification(notification: {
  id: string;
  user_id: string;
  type: string;
  message: string;
}): Promise<unknown> {
  if (!isNeonConfigured()) return null;

  const now = new Date().toISOString();

  const result = await sql<Record<string, unknown>>`
    INSERT INTO notifications (id, user_id, type, message, read, created_at)
    VALUES (${notification.id}, ${notification.user_id}, ${notification.type}, ${notification.message}, 0, ${now})
    RETURNING *
  `;

  return result[0];
}

/**
 * Fetch notifications for a user
 */
export async function fetchNotifications(userId: string): Promise<unknown[]> {
  if (!isNeonConfigured()) return [];

  const result = await sql<Record<string, unknown>>`
    SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50
  `;
  return result;
}

// Export all tools
export const neonTools = {
  executeQuery,
  fetchIncidents,
  fetchIncident,
  createIncident,
  updateIncident,
  fetchTimelineEvents,
  createTimelineEvent,
  fetchAgents,
  updateAgentStatus,
  createNotification,
  fetchNotifications,
};

export default neonTools;
