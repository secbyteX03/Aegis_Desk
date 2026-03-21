import { NextRequest, NextResponse } from "next/server";
import { isNeonConfigured, checkNeonHealth, hybridQuery, hybridInsert, hybridUpdate, hybridDelete, processSyncQueue, getSyncQueueLength, startAutoSync, forceSyncAll } from "@/lib/hybrid-db";

// Initialize auto-sync on module load
startAutoSync(60000); // Sync every minute

console.log("[Sync] Hybrid DB initialized, auto-sync started");

/**
 * Extract table name from the route and validate
 */
function getTableName(table: string): string {
  const allowedTables = [
    "incidents",
    "timeline_events",
    "logs",
    "agents",
    "workflows",
    "audit_log",
    "runbooks",
    "agent_memory",
    "notifications",
    "knowledge_base",
    "team_members",
    "organizations",
    "team_invitations",
  ];

  if (!allowedTables.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  return table;
}

/**
 * Normalize table name between PowerSync and database conventions
 */
function normalizeTableName(table: string): string {
  const tableMap: Record<string, string> = {
    "timelineEvents": "timeline_events",
    "auditLog": "audit_log",
    "agentMemory": "agent_memory",
    "knowledgeBase": "knowledge_base",
    "teamMembers": "team_members",
    "teamInvitations": "team_invitations",
  };

  return tableMap[table] || table;
}

/**
 * GET /api/sync/[table]
 * Fetch records using hybrid database (Neon with local fallback)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const tableName = getTableName(table);
    const normalizedName = normalizeTableName(tableName);

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const limit = parseInt(searchParams.get("limit") || "100");
    const organization_id = searchParams.get("organization_id");

    // Build where clause - filter by organization_id for incidents and timeline_events
    let whereClause: Record<string, unknown> = {};
    if (id) {
      whereClause.id = id;
    }
    if (organization_id && (normalizedName === 'incidents' || normalizedName === 'timeline_events')) {
      whereClause.organization_id = organization_id;
    }

    // Use hybrid query - automatically handles Neon/local fallback
    const result = await hybridQuery(normalizedName, {
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      limit
    });

    // Get pending sync count
    const pendingSync = getSyncQueueLength();

    return NextResponse.json({
      data: result.data,
      source: result.source,
      synced: result.synced,
      pendingSync,
      isDemo: result.source === "local"
    });

  } catch (error) {
    console.error(`[Sync] GET error:`, error);
    return NextResponse.json({
      data: [],
      source: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Helper functions removed - using hybridQuery from hybrid-db instead

/**
 * POST /api/sync/[table]
 * Insert a new record using hybrid database (Neon with local fallback)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const tableName = getTableName(table);
    const normalizedName = normalizeTableName(tableName);

    const body = await request.json();
    const records = Array.isArray(body) ? body : [body];

    // Process record timestamps
    const processedRecord = processRecord(records[0] as Record<string, unknown>);

    // Use hybrid insert - automatically handles Neon/local fallback with sync queue
    const result = await hybridInsert(normalizedName, processedRecord);

    // Get pending sync count
    const pendingSync = getSyncQueueLength();

    return NextResponse.json({
      data: result.data,
      source: result.source,
      synced: result.synced,
      pendingSync
    });

  } catch (error) {
    console.error(`[Sync] POST error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function processRecord(record: Record<string, unknown>): Record<string, unknown> {
  const processed: Record<string, unknown> = { ...record };

  // Handle created_at timestamp conversions
  if (processed.created_at !== undefined) {
    if (typeof processed.created_at === 'number') {
      processed.created_at = new Date(processed.created_at as number).toISOString();
    }
  } else {
    processed.created_at = new Date().toISOString();
  }

  // Handle updated_at timestamp conversions
  if (processed.updated_at === undefined) {
    processed.updated_at = new Date().toISOString();
  } else if (typeof processed.updated_at === 'number') {
    processed.updated_at = new Date(processed.updated_at as number).toISOString();
  }

  // Handle timestamp conversions (for timeline_events and other tables)
  if (processed.timestamp !== undefined) {
    if (typeof processed.timestamp === 'number') {
      processed.timestamp = new Date(processed.timestamp as number).toISOString();
    }
  }

  return processed;
}

// Helper function removed - using hybridInsert from hybrid-db instead

/**
 * PATCH /api/sync/[table]
 * Update an existing record using hybrid database (Neon with local fallback)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const tableName = getTableName(table);
    const normalizedName = normalizeTableName(tableName);

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
    }

    // Use hybrid update - automatically handles Neon/local fallback with sync queue
    const result = await hybridUpdate(normalizedName, id, updateData);

    // Get pending sync count
    const pendingSync = getSyncQueueLength();

    return NextResponse.json({
      data: result.data,
      source: result.source,
      synced: result.synced,
      pendingSync
    });

  } catch (error) {
    console.error(`[Sync] PATCH error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Helper function removed - using hybridUpdate from hybrid-db instead

/**
 * DELETE /api/sync/[table]
 * Delete a record using hybrid database (Neon with local fallback)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const tableName = getTableName(table);
    const normalizedName = normalizeTableName(tableName);

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing required parameter: id" }, { status: 400 });
    }

    // Use hybrid delete - automatically handles Neon/local fallback with sync queue
    const result = await hybridDelete(normalizedName, id);

    // Get pending sync count
    const pendingSync = getSyncQueueLength();

    return NextResponse.json({
      success: result.success,
      source: result.source,
      synced: result.synced,
      pendingSync
    });

  } catch (error) {
    console.error(`[Sync] DELETE error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
