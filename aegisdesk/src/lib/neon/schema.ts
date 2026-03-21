/**
 * Neon Database Schema for AegisDesk
 * PostgreSQL schema that mirrors the PowerSync local schema
 */

import { sql, isNeonConfigured } from "./client";

// Type for database rows
type DbRow = Record<string, unknown>;

/**
 * Initialize the Neon database with all required tables
 */
export async function initializeNeonSchema() {
  if (!isNeonConfigured()) {
    console.warn("[Neon] Not configured - skipping schema initialization");
    return;
  }

  console.log("[Neon] Initializing database schema...");

  try {
    // Create incidents table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      severity INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'Active',
      description TEXT,
      affected_services TEXT,
      root_cause TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by TEXT
    )`;

    // Create timeline_events table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      actor TEXT,
      actor_type TEXT,
      event_type TEXT,
      message TEXT,
      details TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create logs table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      incident_id TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      level TEXT,
      service TEXT,
      message TEXT,
      metadata TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create agents table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT,
      status TEXT DEFAULT 'idle',
      current_task TEXT,
      progress INTEGER DEFAULT 0,
      last_heartbeat TIMESTAMP WITH TIME ZONE,
      capabilities TEXT
    )`;

    // Create workflows table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      incident_id TEXT,
      title TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending',
      actor TEXT,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create audit_log table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      incident_id TEXT,
      actor TEXT,
      action TEXT,
      target TEXT,
      details TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create runbooks table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS runbooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      steps TEXT,
      is_template INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create agent_memory table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS agent_memory (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      pattern_type TEXT,
      pattern_data TEXT,
      confidence REAL DEFAULT 0.0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create presence table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS presence (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_avatar TEXT,
      status TEXT DEFAULT 'offline',
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create notifications table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      -- Team invite specific fields
      invite_token TEXT,
      organization_id TEXT,
      organization_name TEXT
    )`;

    // Create knowledge_base table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      category TEXT,
      tags TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create team_members table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      organization_id TEXT,
      email TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'member',
      status TEXT DEFAULT 'pending',
      invited_by TEXT,
      invited_at TIMESTAMP WITH TIME ZONE,
      confirmed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create organizations table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Create team_invitations table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS team_invitations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      invited_by TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // =============================================
    // AUTH TABLES - User authentication system
    // =============================================

    // Users table - replaces Supabase auth.users
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      avatar_url TEXT,
      email_verified BOOLEAN DEFAULT FALSE,
      email_verification_token TEXT,
      password_reset_token TEXT,
      password_reset_expires TIMESTAMP WITH TIME ZONE,
      last_sign_in_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // Profiles table - extends users with additional data
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      role TEXT DEFAULT 'User',
      organization_id TEXT,
      bio TEXT,
      timezone TEXT DEFAULT 'UTC',
      language TEXT DEFAULT 'en',
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    // User sessions table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      user_agent TEXT,
      ip_address TEXT
    )`;

    // OAuth accounts table
    await sql<DbRow>`CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      provider_user_data JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(provider, provider_account_id)
    )`;

    console.log("[Neon] Database schema initialized successfully");
  } catch (error) {
    console.error("[Neon] Error initializing schema:", error);
    throw error;
  }
}

/**
 * Get all incidents from Neon
 */
export async function getAllIncidents(): Promise<DbRow[]> {
  if (!isNeonConfigured()) return [];
  return await sql<DbRow>`SELECT * FROM incidents ORDER BY created_at DESC`;
}

/**
 * Get incident by ID
 */
export async function getIncidentById(id: string): Promise<DbRow | null> {
  if (!isNeonConfigured()) return null;
  const result = await sql<DbRow>`SELECT * FROM incidents WHERE id = ${id}`;
  return result[0] || null;
}

/**
 * Create incident in Neon
 */
export async function createIncident(incident: {
  id: string;
  title: string;
  severity: number;
  status: string;
  description?: string;
  affected_services?: string;
  root_cause?: string;
  created_by?: string;
}): Promise<DbRow | null> {
  if (!isNeonConfigured()) return null;

  const result = await sql<DbRow>`
    INSERT INTO incidents (id, title, severity, status, description, affected_services, root_cause, created_by)
    VALUES (${incident.id}, ${incident.title}, ${incident.severity}, ${incident.status}, ${incident.description}, ${incident.affected_services}, ${incident.root_cause}, ${incident.created_by})
    RETURNING *
  `;
  return result[0];
}

/**
 * Update incident in Neon
 */
export async function updateIncident(id: string, data: Record<string, unknown>): Promise<DbRow | null> {
  if (!isNeonConfigured()) return null;

  // Build dynamic update query
  const fields = Object.keys(data);
  if (fields.length === 0) return null;

  // Use a workaround for dynamic updates
  const title = data.title as string | undefined;
  const severity = data.severity as number | undefined;
  const status = data.status as string | undefined;
  const description = data.description as string | undefined;
  const affectedServices = data.affected_services as string | undefined;
  const rootCause = data.root_cause as string | undefined;

  const result = await sql<DbRow>`
    UPDATE incidents 
    SET title = COALESCE(${title}, title),
        severity = COALESCE(${severity}, severity),
        status = COALESCE(${status}, status),
        description = COALESCE(${description}, description),
        affected_services = COALESCE(${affectedServices}, affected_services),
        root_cause = COALESCE(${rootCause}, root_cause),
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
}

/**
 * Delete incident from Neon
 */
export async function deleteIncident(id: string): Promise<void> {
  if (!isNeonConfigured()) return;
  await sql<DbRow>`DELETE FROM incidents WHERE id = ${id}`;
}

// Export all table names for reference
export const TABLE_NAMES = [
  // Core tables
  "incidents",
  "timeline_events",
  "logs",
  "agents",
  "workflows",
  "audit_log",
  "runbooks",
  "agent_memory",
  "presence",
  "notifications",
  "knowledge_base",
  // Team tables
  "team_members",
  "organizations",
  "team_invitations",
  // Auth tables
  "users",
  "profiles",
  "user_sessions",
  "oauth_accounts",
] as const;
