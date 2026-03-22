import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

function getSql() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }
  return neon(DATABASE_URL);
}

/**
 * POST /api/init
 * Initialize the database with tables and demo data
 * Query param: force=true to rebuild even with existing data
 */
export async function POST(request: Request) {
  if (!DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL not configured" },
      { status: 500 }
    );
  }

  let force = false;
  try {
    const url = new URL(request.url);
    force = url.searchParams.get('force') === 'true';
  } catch { }

  console.log("[Init] Creating database tables...");
  const sql = getSql();

  try {
    // Check existing counts
    const existingIncidents = await sql`SELECT COUNT(*) as count FROM incidents`;
    const existingTimeline = await sql`SELECT COUNT(*) as count FROM timeline_events`;
    const existingAgents = await sql`SELECT COUNT(*) as count FROM agents`;

    // Check if team_invitations table exists, if not create it
    try {
      await sql`SELECT 1 FROM team_invitations LIMIT 1`;
    } catch {
      console.log("[Init] Creating team_invitations table...");
      await sql`CREATE TABLE IF NOT EXISTS team_invitations (
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
      console.log("[Init] team_invitations table created");
    }

    // Add data column to notifications table if it doesn't exist
    try {
      await sql`ALTER TABLE notifications ADD COLUMN data TEXT`;
      console.log("[Init] Added data column to notifications table");
    } catch (e) {
      // Column may already exist, ignore error
      console.log("[Init] notifications data column check: already exists or other error");
    }

    const incidentCount = Number(existingIncidents[0]?.count || 0);
    const timelineCount = Number(existingTimeline[0]?.count || 0);
    const agentCount = Number(existingAgents[0]?.count || 0);

    // Drop and recreate tables only if force=true or any table is empty
    const needsInit = incidentCount === 0 || timelineCount === 0 || agentCount === 0 || force;

    if (needsInit) {
      console.log("[Init] Rebuilding tables (force=" + force + ", incidents=" + incidentCount + ", timeline=" + timelineCount + ", agents=" + agentCount + ")");
      await sql`DROP TABLE IF EXISTS timeline_events CASCADE`;
      await sql`DROP TABLE IF EXISTS incidents CASCADE`;
      await sql`DROP TABLE IF EXISTS agents CASCADE`;

      // Create incidents table
      await sql`CREATE TABLE incidents (
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
      await sql`CREATE TABLE timeline_events (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        actor TEXT,
        actor_type TEXT,
        event_type TEXT,
        message TEXT,
        details TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;

      // Create agents table
      await sql`CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        specialty TEXT,
        status TEXT DEFAULT 'idle',
        current_task TEXT,
        progress INTEGER DEFAULT 0,
        last_heartbeat TIMESTAMP WITH TIME ZONE,
        capabilities TEXT,
        organization_id TEXT
      )`;

      // Create team_invitations table
      await sql`CREATE TABLE IF NOT EXISTS team_invitations (
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

      console.log("[Init] Tables created successfully");

      const now = new Date().toISOString();

      // Seed incidents only if empty
      if (incidentCount === 0) {
        console.log("[Init] Seeding incidents...");
        await sql`
          INSERT INTO incidents (id, title, severity, status, description, affected_services, created_at, updated_at)
          VALUES 
            ('INC-001', 'API Gateway 502 Errors', 1, 'investigating', 'Multiple 502 errors from API Gateway', 'api-gateway', ${now}, ${now}),
            ('INC-002', 'Database Connection Pool Exhausted', 2, 'open', 'PostgreSQL at 100% capacity', 'database', ${now}, ${now}),
            ('INC-003', 'Elevated Latency in Checkout', 3, 'Active', 'Checkout 500ms+ latency', 'checkout', ${now}, ${now})
        `;
      }

      // Seed timeline only if empty
      if (timelineCount === 0) {
        console.log("[Init] Seeding timeline events...");
        await sql`
          INSERT INTO timeline_events (id, incident_id, actor, actor_type, event_type, message, timestamp)
          VALUES 
            ('tl-001', 'INC-001', 'Triage-7', 'agent', 'action', 'Detected 502 errors', ${now}),
            ('tl-002', 'INC-001', 'System', 'system', 'info', 'Alert triggered', ${now}),
            ('tl-003', 'INC-002', 'System', 'system', 'warning', 'Pool at 100%', ${now}),
            ('tl-004', 'INC-003', 'Comms-1', 'agent', 'action', 'Notifying stakeholders', ${now})
        `;
      }

      // Seed agents only if empty
      if (agentCount === 0) {
        console.log("[Init] Seeding agents...");
        const orgId = 'org-demo-001';
        await sql`
          INSERT INTO agents (id, name, specialty, status, progress, last_heartbeat, organization_id)
          VALUES 
            ('triage7', 'Triage-7', 'Log Analysis', 'idle', 100, ${now}, ${orgId}),
            ('remedy3', 'Remedy-3', 'Runbook Execution', 'idle', 0, ${now}, ${orgId}),
            ('comms1', 'Comms-1', 'Stakeholder Comms', 'idle', 0, ${now}, ${orgId}),
            ('postmort2', 'PostMort-2', 'Post-Mortem', 'idle', 0, ${now}, ${orgId})
        `;
      }

      console.log("[Init] Demo data seeded successfully");
    }

    // Get final counts
    const finalIncidents = await sql`SELECT COUNT(*) as count FROM incidents`;
    const finalTimeline = await sql`SELECT COUNT(*) as count FROM timeline_events`;
    const finalAgents = await sql`SELECT COUNT(*) as count FROM agents`;

    return NextResponse.json({
      success: true,
      message: needsInit ? "Database initialized with demo data" : "Database already initialized",
      counts: {
        incidents: Number(finalIncidents[0]?.count || 0),
        timeline: Number(finalTimeline[0]?.count || 0),
        agents: Number(finalAgents[0]?.count || 0)
      }
    });
  } catch (error) {
    console.error("[Init] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/init
 * Check database status
 */
export async function GET() {
  if (!DATABASE_URL) {
    return NextResponse.json({ configured: false, message: "DATABASE_URL not set" });
  }

  try {
    const sql = getSql();
    const incidents = await sql`SELECT COUNT(*) as count FROM incidents`;
    const timeline = await sql`SELECT COUNT(*) as count FROM timeline_events`;
    const agents = await sql`SELECT COUNT(*) as count FROM agents`;

    return NextResponse.json({
      configured: true,
      counts: {
        incidents: Number(incidents[0]?.count || 0),
        timeline: Number(timeline[0]?.count || 0),
        agents: Number(agents[0]?.count || 0)
      }
    });
  } catch (error) {
    return NextResponse.json({
      configured: false,
      message: error instanceof Error ? error.message : "Database connection failed"
    });
  }
}
