/**
 * Hybrid Database Client for AegisDesk
 * Provides offline-first functionality with Neon as primary and local storage fallback
 * 
 * Features:
 * - Automatic Neon connection health checks
 * - Persistent sync queue for offline operations
 * - Automatic sync when Neon becomes available
 * - Graceful degradation to local storage
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

// Types
export interface SyncQueueItem {
    id: string;
    table: string;
    operation: "INSERT" | "UPDATE" | "DELETE";
    data: Record<string, unknown>;
    timestamp: number;
    retries: number;
}

export interface DatabaseHealth {
    neon: {
        available: boolean;
        latency?: number;
        lastCheck: number;
    };
    local: {
        available: boolean;
        pendingOperations: number;
    };
}

export interface HybridQueryResult<T = unknown> {
    data: T[];
    source: "neon" | "local" | "hybrid";
    synced?: boolean;
}

// Configuration
const SYNC_QUEUE_DIR = join(process.cwd(), ".sync-queue");
const SYNC_QUEUE_FILE = join(SYNC_QUEUE_DIR, "queue.json");
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Ensure sync queue directory exists
function ensureSyncQueueDir() {
    if (!existsSync(SYNC_QUEUE_DIR)) {
        mkdirSync(SYNC_QUEUE_DIR, { recursive: true });
    }
}

// Get database URL
function getDatabaseUrl(): string {
    return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
}

// Check if Neon is configured
export function isNeonConfigured(): boolean {
    const databaseUrl = getDatabaseUrl();
    return databaseUrl !== "";
}

// Neon client management
let cachedClient: NeonQueryFunction<false, false> | null = null;
let cachedUrl: string = "";

function getNeonClient(): NeonQueryFunction<false, false> | null {
    const databaseUrl = getDatabaseUrl();

    if (!databaseUrl) {
        return null;
    }

    if (!cachedClient || cachedUrl !== databaseUrl) {
        console.log("[HybridDB] Creating new Neon client...");
        cachedClient = neon(databaseUrl);
        cachedUrl = databaseUrl;
    }

    return cachedClient;
}

// Health check cache
let cachedHealth: DatabaseHealth | null = null;
let lastHealthCheck = 0;

/**
 * Check Neon database health with latency measurement
 */
export async function checkNeonHealth(): Promise<{ available: boolean; latency?: number }> {
    const now = Date.now();

    // Return cached result if recent
    if (cachedHealth && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
        return {
            available: cachedHealth.neon.available,
            latency: cachedHealth.neon.latency
        };
    }

    if (!isNeonConfigured()) {
        cachedHealth = {
            neon: { available: false, lastCheck: now },
            local: { available: true, pendingOperations: getSyncQueueLength() }
        };
        lastHealthCheck = now;
        return { available: false };
    }

    const startTime = Date.now();

    try {
        const client = getNeonClient();
        if (!client) {
            return { available: false };
        }

        await client`SELECT 1`;
        const latency = Date.now() - startTime;

        cachedHealth = {
            neon: { available: true, latency, lastCheck: now },
            local: { available: true, pendingOperations: getSyncQueueLength() }
        };
        lastHealthCheck = now;

        console.log(`[HybridDB] Neon health check: OK (${latency}ms)`);
        return { available: true, latency };
    } catch (error) {
        console.error("[HybridDB] Neon health check: FAILED", error);

        cachedHealth = {
            neon: { available: false, lastCheck: now },
            local: { available: true, pendingOperations: getSyncQueueLength() }
        };
        lastHealthCheck = now;

        return { available: false };
    }
}

/**
 * Get full database health status
 */
export async function getDatabaseHealth(): Promise<DatabaseHealth> {
    if (!cachedHealth || Date.now() - lastHealthCheck > HEALTH_CHECK_INTERVAL) {
        await checkNeonHealth();
    }
    return cachedHealth || {
        neon: { available: false, lastCheck: Date.now() },
        local: { available: true, pendingOperations: getSyncQueueLength() }
    };
}

// Sync Queue Operations

/**
 * Get all pending sync queue items
 */
export function getSyncQueue(): SyncQueueItem[] {
    ensureSyncQueueDir();

    if (!existsSync(SYNC_QUEUE_FILE)) {
        return [];
    }

    try {
        const data = readFileSync(SYNC_QUEUE_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error("[HybridDB] Error reading sync queue:", error);
        return [];
    }
}

/**
 * Get sync queue length
 */
export function getSyncQueueLength(): number {
    return getSyncQueue().length;
}

/**
 * Add item to sync queue
 */
export function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp" | "retries">): SyncQueueItem {
    const queue = getSyncQueue();

    const newItem: SyncQueueItem = {
        ...item,
        id: `${item.table}-${item.operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retries: 0
    };

    queue.push(newItem);

    ensureSyncQueueDir();
    writeFileSync(SYNC_QUEUE_FILE, JSON.stringify(queue, null, 2));

    console.log(`[HybridDB] Added to sync queue: ${newItem.id} (${item.operation} ${item.table})`);

    return newItem;
}

/**
 * Remove item from sync queue
 */
export function removeFromSyncQueue(id: string): void {
    const queue = getSyncQueue();
    const filtered = queue.filter(item => item.id !== id);

    ensureSyncQueueDir();
    writeFileSync(SYNC_QUEUE_FILE, JSON.stringify(filtered, null, 2));

    console.log(`[HybridDB] Removed from sync queue: ${id}`);
}

/**
 * Update item retry count
 */
export function incrementRetryCount(id: string): void {
    const queue = getSyncQueue();
    const item = queue.find(i => i.id === id);

    if (item) {
        item.retries += 1;
        ensureSyncQueueDir();
        writeFileSync(SYNC_QUEUE_FILE, JSON.stringify(queue, null, 2));
    }
}

// Local storage for fallback data
const LOCAL_DATA_DIR = join(process.cwd(), ".local-data");
const LOCAL_DATA_FILE = join(LOCAL_DATA_DIR, "database.json");

interface LocalDatabase {
    [table: string]: Record<string, unknown>[];
}

function ensureLocalDataDir() {
    if (!existsSync(LOCAL_DATA_DIR)) {
        mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
}

function getLocalDatabase(): LocalDatabase {
    ensureLocalDataDir();

    if (!existsSync(LOCAL_DATA_FILE)) {
        return {};
    }

    try {
        const data = readFileSync(LOCAL_DATA_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return {};
    }
}

function saveLocalDatabase(db: LocalDatabase): void {
    ensureLocalDataDir();
    writeFileSync(LOCAL_DATA_FILE, JSON.stringify(db, null, 2));
}

// Hybrid Database Operations

/**
 * Execute a hybrid query - tries Neon first, falls back to local
 */
export async function hybridQuery<T = unknown>(
    table: string,
    options: {
        select?: string[];
        where?: Record<string, unknown>;
        orderBy?: string;
        limit?: number;
    } = {}
): Promise<HybridQueryResult<T>> {
    const { select = ["*"], where, orderBy = "id DESC", limit = 100 } = options;

    // Try Neon first
    const health = await checkNeonHealth();

    if (health.available) {
        try {
            const client = getNeonClient();
            if (client) {
                const columns = select.join(", ");
                let query = `SELECT ${columns} FROM ${table}`;

                if (where && Object.keys(where).length > 0) {
                    const whereClause = Object.keys(where)
                        .map(key => `${key} = $${Object.keys(where).indexOf(key) + 1}`)
                        .join(" AND ");
                    query += ` WHERE ${whereClause}`;
                }

                query += ` ORDER BY ${orderBy} LIMIT ${limit}`;

                const result = await clientUnsafe(query, Object.values(where || {}));

                return {
                    data: result as T[],
                    source: "neon",
                    synced: true
                };
            }
        } catch (error) {
            console.error(`[HybridDB] Neon query failed, falling back to local:`, error);
        }
    }

    // Fallback to local storage
    const localDb = getLocalDatabase();
    let data = localDb[table] || [];

    // Apply filters
    if (where) {
        data = data.filter(record => {
            return Object.entries(where).every(([key, value]) => record[key] === value);
        });
    }

    // Apply ordering (simple implementation)
    if (orderBy) {
        const [field, direction] = orderBy.split(" ");
        data.sort((a, b) => {
            const aVal = (a as any)[field];
            const bVal = (b as any)[field];
            if (aVal < bVal) return direction === "ASC" ? -1 : 1;
            if (aVal > bVal) return direction === "ASC" ? 1 : -1;
            return 0;
        });
    }

    // Apply limit
    data = data.slice(0, limit);

    return {
        data: data as T[],
        source: "local",
        synced: false
    };
}

/**
 * Execute a raw Neon query with error handling
 */
async function clientUnsafe(query: string, params: unknown[] = []): Promise<unknown[]> {
    const client = getNeonClient();
    if (!client) {
        throw new Error("Neon client not available");
    }

    try {
        // Use Neon client with the (string, params[]) overload
        // This avoids the template literal parsing issues
        const result = await (client as (str: string, params?: unknown[]) => Promise<{ rows: unknown[] }>)(query, params);

        // Neon client returns result with rows property - extract rows for queries
        // If result has rows (SELECT query), return rows array
        if (result && typeof result === 'object' && 'rows' in result) {
            return (result as { rows: unknown[] }).rows;
        }

        // For non-SELECT queries or other results, return as array
        return result as unknown as unknown[];
    } catch (error) {
        console.error("[HybridDB] Neon query error:", error);
        throw error;
    }
}

/**
 * Insert a record - tries Neon first, queues for sync if unavailable
 */
export async function hybridInsert<T = unknown>(
    table: string,
    data: Record<string, unknown>
): Promise<{ data: T; source: "neon" | "local"; synced: boolean }> {
    // Use cached health if available to avoid blocking on health check
    let healthStatus = cachedHealth?.neon?.available;

    // Only do a quick async health check if we don't have a recent cached result
    if (healthStatus === undefined) {
        // Don't await - use cached/default and proceed
        checkNeonHealth().catch(() => { }); // Fire and forget
    }

    // Add timestamps
    const record = {
        ...data,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
    };

    // Try Neon insert if we think it's available (or unknown - try anyway)
    if (healthStatus === true || healthStatus === undefined) {
        try {
            const client = getNeonClient();
            if (client) {
                // Use tagged template literals for Neon client
                const { id, title, description, severity, status, affected_services, root_cause, created_by, created_at, updated_at } = record as any;

                let result;
                if (table === "incidents") {
                    result = await client`INSERT INTO incidents (id, title, description, severity, status, affected_services, root_cause, created_by, created_at, updated_at) VALUES (${id}, ${title}, ${description}, ${severity}, ${status}, ${affected_services}, ${root_cause}, ${created_by}, ${created_at}, ${updated_at}) RETURNING *`;
                } else if (table === "timeline_events") {
                    const { id: te_id, incident_id, actor, actor_type, event_type, message, details, timestamp } = record as any;
                    result = await client`INSERT INTO timeline_events (id, incident_id, actor, actor_type, event_type, message, details, timestamp) VALUES (${te_id}, ${incident_id}, ${actor}, ${actor_type}, ${event_type}, ${message}, ${details}, ${timestamp}) RETURNING *`;
                } else if (table === "notifications") {
                    const { id: n_id, user_id, type, message, read, created_at: n_created_at } = record as any;
                    result = await client`INSERT INTO notifications (id, user_id, type, message, read, created_at) VALUES (${n_id}, ${user_id}, ${type}, ${message}, ${read}, ${n_created_at}) RETURNING *`;
                } else {
                    // Generic insert - use columns and values from record
                    const cols = Object.keys(record);
                    const vals = Object.values(record);
                    const colStr = cols.join(", ");
                    const valStr = cols.map((_, i) => `${i + 1}`).join(", ");
                    // This won't work with tagged template - fallback to local
                    throw new Error(`Table ${table} not supported for generic insert`);
                }

                console.log(`[HybridDB] Inserted to Neon: ${table}`);

                return {
                    data: result[0] as T,
                    source: "neon",
                    synced: true
                };
            }
        } catch (error) {
            console.error(`[HybridDB] Neon insert failed, queuing for sync:`, error);
        }
    }

    // Save to local storage (fallback)
    const localDb = getLocalDatabase();
    if (!localDb[table]) {
        localDb[table] = [];
    }

    const recordAny = record as any;
    const recordWithId = {
        ...record,
        id: recordAny.id || `${table}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    localDb[table].push(recordWithId);
    saveLocalDatabase(localDb);

    // Queue for sync
    addToSyncQueue({
        table,
        operation: "INSERT",
        data: recordWithId
    });

    console.log(`[HybridDB] Inserted to local storage: ${table} (queued for sync)`);

    return {
        data: recordWithId as T,
        source: "local",
        synced: false
    };
}

/**
 * Update a record - tries Neon first, queues for sync if unavailable
 */
export async function hybridUpdate<T = unknown>(
    table: string,
    id: string,
    data: Record<string, unknown>
): Promise<{ data: T; source: "neon" | "local"; synced: boolean }> {
    const health = await checkNeonHealth();

    const updateData = {
        ...data,
        updated_at: new Date().toISOString()
    };

    if (health.available) {
        try {
            const client = getNeonClient();
            if (client) {
                const setClause = Object.keys(updateData)
                    .map((key, i) => `${key} = $${i + 2}`)
                    .join(", ");

                const result = await (client as (str: string, params?: unknown[]) => Promise<any>)(
                    `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`,
                    [id, ...Object.values(updateData)]
                );

                console.log(`[HybridDB] Updated in Neon: ${table}/${id}`);

                return {
                    data: result[0] as T,
                    source: "neon",
                    synced: true
                };
            }
        } catch (error) {
            console.error(`[HybridDB] Neon update failed, queuing for sync:`, error);
        }
    }

    // Update in local storage
    const localDb = getLocalDatabase();
    const tableData = localDb[table] || [];
    const index = tableData.findIndex((r: Record<string, unknown>) => r.id === id);

    if (index >= 0) {
        tableData[index] = { ...tableData[index], ...updateData };
        localDb[table] = tableData;
        saveLocalDatabase(localDb);

        // Queue for sync
        addToSyncQueue({
            table,
            operation: "UPDATE",
            data: { id, ...updateData }
        });

        console.log(`[HybridDB] Updated in local storage: ${table}/${id} (queued for sync)`);

        return {
            data: tableData[index] as T,
            source: "local",
            synced: false
        };
    }

    throw new Error(`Record not found: ${table}/${id}`);
}

/**
 * Delete a record - tries Neon first, queues for sync if unavailable
 */
export async function hybridDelete(
    table: string,
    id: string
): Promise<{ success: boolean; source: "neon" | "local"; synced: boolean }> {
    const health = await checkNeonHealth();

    if (health.available) {
        try {
            const client = getNeonClient();
            if (client) {
                await (client as (str: string, params?: unknown[]) => Promise<any>)(`DELETE FROM ${table} WHERE id = $1`, [id]);

                console.log(`[HybridDB] Deleted from Neon: ${table}/${id}`);

                return {
                    success: true,
                    source: "neon",
                    synced: true
                };
            }
        } catch (error) {
            console.error(`[HybridDB] Neon delete failed, queuing for sync:`, error);
        }
    }

    // Delete from local storage
    const localDb = getLocalDatabase();
    if (localDb[table]) {
        localDb[table] = localDb[table].filter((r: Record<string, unknown>) => r.id !== id);
        saveLocalDatabase(localDb);

        // Queue for sync
        addToSyncQueue({
            table,
            operation: "DELETE",
            data: { id }
        });

        console.log(`[HybridDB] Deleted from local storage: ${table}/${id} (queued for sync)`);

        return {
            success: true,
            source: "local",
            synced: false
        };
    }

    return {
        success: true,
        source: "local",
        synced: false
    };
}

// Sync Operations

/**
 * Process pending sync queue - syncs local data to Neon
 */
export async function processSyncQueue(): Promise<{
    success: number;
    failed: number;
    total: number;
}> {
    const queue = getSyncQueue();

    if (queue.length === 0) {
        return { success: 0, failed: 0, total: 0 };
    }

    const health = await checkNeonHealth();

    if (!health.available) {
        console.log("[HybridDB] Cannot process sync queue - Neon unavailable");
        return { success: 0, failed: 0, total: queue.length };
    }

    let success = 0;
    let failed = 0;

    for (const item of queue) {
        if (item.retries >= MAX_RETRIES) {
            console.warn(`[HybridDB] Skipping item after max retries: ${item.id}`);
            removeFromSyncQueue(item.id);
            failed++;
            continue;
        }

        try {
            const client = getNeonClient();
            if (!client) {
                throw new Error("Neon client not available");
            }

            if (item.operation === "INSERT") {
                const columns = Object.keys(item.data).join(", ");
                const placeholders = Object.keys(item.data).map((_, i) => `$${i + 1}`).join(", ");

                await (client as (str: string, params?: unknown[]) => Promise<any>)(
                    `INSERT INTO ${item.table} (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(item.data).map(key => `${key} = EXCLUDED.${key}`).join(", ")}`,
                    Object.values(item.data)
                );
            } else if (item.operation === "UPDATE") {
                const { id, ...updateData } = item.data;
                const setClause = Object.keys(updateData)
                    .map((key, i) => `${key} = $${i + 2}`)
                    .join(", ");

                await (client as (str: string, params?: unknown[]) => Promise<any>)(
                    `UPDATE ${item.table} SET ${setClause}, updated_at = NOW() WHERE id = $1`,
                    [id, ...Object.values(updateData)]
                );
            } else if (item.operation === "DELETE") {
                await (client as (str: string, params?: unknown[]) => Promise<any>)(`DELETE FROM ${item.table} WHERE id = $1`, [item.data.id]);
            }

            removeFromSyncQueue(item.id);
            success++;
            console.log(`[HybridDB] Synced: ${item.operation} ${item.table}`);
        } catch (error) {
            console.error(`[HybridDB] Failed to sync item: ${item.id}`, error);
            incrementRetryCount(item.id);
            failed++;
        }
    }

    // Invalidate health cache after sync
    cachedHealth = null;

    return { success, failed, total: queue.length };
}

/**
 * Start automatic sync process
 */
let syncInterval: NodeJS.Timeout | null = null;

export function startAutoSync(intervalMs: number = 60000): void {
    if (syncInterval) {
        return;
    }

    console.log(`[HybridDB] Starting auto-sync every ${intervalMs}ms`);

    syncInterval = setInterval(async () => {
        const health = await checkNeonHealth();

        if (health.available) {
            const queueLength = getSyncQueueLength();

            if (queueLength > 0) {
                console.log(`[HybridDB] Auto-syncing ${queueLength} pending operations...`);
                const result = await processSyncQueue();
                console.log(`[HybridDB] Auto-sync complete: ${result.success} success, ${result.failed} failed`);
            }
        }
    }, intervalMs);
}

export function stopAutoSync(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log("[HybridDB] Stopped auto-sync");
    }
}

/**
 * Force sync all pending operations
 */
export async function forceSyncAll(): Promise<{
    success: number;
    failed: number;
    total: number;
}> {
    // First check Neon health
    const health = await checkNeonHealth();

    if (!health.available) {
        throw new Error("Cannot force sync - Neon is not available");
    }

    return processSyncQueue();
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
    pendingCount: number;
    lastSync: number | null;
    autoSyncEnabled: boolean;
} {
    const queue = getSyncQueue();
    const lastItem = queue.length > 0 ? queue[queue.length - 1] : null;

    return {
        pendingCount: queue.length,
        lastSync: lastItem?.timestamp || null,
        autoSyncEnabled: syncInterval !== null
    };
}

// Export SQL function for direct Neon access
export function sql<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
    const client = getNeonClient();
    if (!client) {
        throw new Error("[HybridDB] Database URL not configured! Set DATABASE_URL in .env");
    }
    return client(strings, ...values) as Promise<T[]>;
}
